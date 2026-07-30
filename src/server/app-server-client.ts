import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { delimiter, dirname } from "node:path";

import type {
  ConfigReadResponse,
  ConfigWriteResponse,
  SkillConfigEntry,
  SkillsListResponse,
} from "../shared/contracts.js";

const DEFAULT_REQUEST_TIMEOUT_MS = 10_000;
const MAX_BUFFERED_LINE_LENGTH = 1024 * 1024;

type RequestId = number;

interface PendingRequest {
  method: string;
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

interface RpcError {
  code?: number;
  message?: string;
  data?: unknown;
}

export interface LineTransport {
  write(message: string): void;
  onLine(listener: (line: string) => void): () => void;
  onExit(listener: (error: Error) => void): () => void;
  close(): Promise<void>;
}

export function codexChildEnvironment(
  codexCommand: string,
  environment: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const commandDirectory = dirname(codexCommand);
  const pathEntries = (environment.PATH ?? "").split(delimiter).filter(Boolean);
  return {
    ...environment,
    PATH: [
      commandDirectory,
      ...pathEntries.filter((entry) => entry !== commandDirectory),
    ].join(delimiter),
  };
}

export class CodexAppServerLineTransport implements LineTransport {
  private readonly child: ChildProcessWithoutNullStreams;
  private readonly lineListeners = new Set<(line: string) => void>();
  private readonly exitListeners = new Set<(error: Error) => void>();
  private stdoutBuffer = "";
  private stderrBuffer = "";
  private terminalError: Error | undefined;
  private closePromise: Promise<void> | undefined;
  private resolveClose: (() => void) | undefined;

  constructor(codexCommand = "codex") {
    this.child = spawn(codexCommand, ["app-server", "--stdio"], {
      env: codexChildEnvironment(codexCommand),
      shell: false,
      stdio: ["pipe", "pipe", "pipe"],
    });

    this.child.stdout.setEncoding("utf8");
    this.child.stderr.setEncoding("utf8");
    this.child.stdout.on("data", (chunk: string) => {
      this.consumeStdout(chunk);
    });
    this.child.stderr.on("data", (chunk: string) => {
      this.stderrBuffer = `${this.stderrBuffer}${chunk}`.slice(-16_384);
    });
    this.child.stdin.on("error", (error: Error) => {
      this.finish(error);
    });
    this.child.on("error", (error) => {
      this.finish(error);
    });
    this.child.on("exit", (code, signal) => {
      const details = this.stderrBuffer.trim();
      const suffix = details.length > 0 ? `: ${details}` : "";
      this.finish(
        new Error(
          `Codex app-server exited (code ${String(code)}, signal ${String(signal)})${suffix}`,
        ),
      );
    });
  }

  write(message: string): void {
    if (this.terminalError !== undefined || this.child.stdin.destroyed) {
      throw this.terminalError ?? new Error("Codex app-server is closed");
    }

    this.child.stdin.write(`${message}\n`, (error) => {
      if (error !== null && error !== undefined) {
        this.finish(error);
      }
    });
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  onExit(listener: (error: Error) => void): () => void {
    this.exitListeners.add(listener);
    if (this.terminalError !== undefined) {
      queueMicrotask(() => {
        if (this.exitListeners.has(listener)) {
          listener(this.terminalError as Error);
        }
      });
    }
    return () => {
      this.exitListeners.delete(listener);
    };
  }

  close(): Promise<void> {
    if (this.closePromise !== undefined) {
      return this.closePromise;
    }
    if (this.terminalError !== undefined) {
      return Promise.resolve();
    }

    this.closePromise = new Promise<void>((resolve) => {
      this.resolveClose = resolve;
      this.child.stdin.end();
      this.child.kill();
    });
    return this.closePromise;
  }

  private consumeStdout(chunk: string): void {
    const input = this.stdoutBuffer + chunk;
    let lineStart = 0;
    let newlineIndex = input.indexOf("\n", lineStart);

    while (newlineIndex !== -1) {
      const rawLine = input.slice(lineStart, newlineIndex);
      if (rawLine.length > MAX_BUFFERED_LINE_LENGTH) {
        this.abortOversizedLine();
        return;
      }
      const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
      for (const listener of this.lineListeners) {
        listener(line);
      }
      lineStart = newlineIndex + 1;
      newlineIndex = input.indexOf("\n", lineStart);
    }

    this.stdoutBuffer = input.slice(lineStart);
    if (this.stdoutBuffer.length > MAX_BUFFERED_LINE_LENGTH) {
      this.abortOversizedLine();
    }
  }

  private abortOversizedLine(): void {
    this.finish(
      new Error(
        `Codex app-server exceeded the ${MAX_BUFFERED_LINE_LENGTH}-character line limit`,
      ),
    );
    this.child.kill();
  }

  private finish(error: Error): void {
    if (this.terminalError !== undefined) {
      return;
    }
    this.terminalError = error;
    for (const listener of this.exitListeners) {
      listener(error);
    }
    this.resolveClose?.();
    this.resolveClose = undefined;
  }
}

export class AppServerClient {
  private readonly pending = new Map<RequestId, PendingRequest>();
  private readonly notificationListeners = new Map<
    string,
    Set<(params: unknown) => void>
  >();
  private readonly ready: Promise<void>;
  private readonly unsubscribeLine: () => void;
  private readonly unsubscribeExit: () => void;
  private nextId = 1;
  private terminalError: Error | undefined;
  private closePromise: Promise<void> | undefined;
  private batchWriteCapability: Promise<boolean> | undefined;

  constructor(private readonly transport: LineTransport = new CodexAppServerLineTransport()) {
    this.unsubscribeLine = this.transport.onLine((line) => {
      this.handleLine(line);
    });
    this.unsubscribeExit = this.transport.onExit((error) => {
      this.fail(error);
    });
    this.ready = this.initialize();
    void this.ready.catch(() => undefined);
  }

  async request<T>(
    method: string,
    params: unknown,
    timeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  ): Promise<T> {
    if (this.terminalError !== undefined) {
      throw this.terminalError;
    }
    await this.ready;
    return this.sendRequest<T>(method, params, timeoutMs);
  }

  onNotification(
    method: string,
    listener: (params: unknown) => void,
  ): () => void {
    let listeners = this.notificationListeners.get(method);
    if (listeners === undefined) {
      listeners = new Set();
      this.notificationListeners.set(method, listeners);
    }
    listeners.add(listener);

    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        this.notificationListeners.delete(method);
      }
    };
  }

  listSkills(
    cwds: string[],
    forceReload?: boolean,
  ): Promise<SkillsListResponse> {
    return this.request("skills/list", {
      cwds,
      ...(forceReload === undefined ? {} : { forceReload }),
    });
  }

  readConfig(cwd?: string): Promise<ConfigReadResponse> {
    return this.request("config/read", {
      includeLayers: true,
      ...(cwd === undefined ? {} : { cwd }),
    });
  }

  batchWriteSkillsConfig(
    value: SkillConfigEntry[],
    expectedVersion: string,
  ): Promise<ConfigWriteResponse> {
    return this.request("config/batchWrite", {
      edits: [
        {
          keyPath: "skills.config",
          value,
          mergeStrategy: "replace",
        },
      ],
      expectedVersion,
      reloadUserConfig: false,
    });
  }

  async readFile(path: string): Promise<string> {
    const response = await this.request<{ dataBase64: string }>("fs/readFile", { path });
    return Buffer.from(response.dataBase64, "base64").toString("utf8");
  }

  async writeFile(path: string, value: string): Promise<void> {
    await this.request("fs/writeFile", {
      path,
      dataBase64: Buffer.from(value, "utf8").toString("base64"),
    });
  }

  async readDirectory(path: string): Promise<Array<{
    fileName: string;
    isDirectory: boolean;
    isFile: boolean;
  }>> {
    const response = await this.request<{
      entries: Array<{ fileName: string; isDirectory: boolean; isFile: boolean }>;
    }>("fs/readDirectory", { path });
    return response.entries;
  }

  async createDirectory(path: string): Promise<void> {
    await this.request("fs/createDirectory", { path, recursive: true });
  }

  canBatchWrite(): Promise<boolean> {
    this.batchWriteCapability ??= this.request("config/batchWrite", {})
      .then(() => true)
      .catch((error: Error & { code?: number }) => {
        if (error.code === -32601) return false;
        if (error.code === -32600 || error.code === -32602) return true;
        throw error;
      });
    return this.batchWriteCapability;
  }

  close(): Promise<void> {
    if (this.closePromise !== undefined) {
      return this.closePromise;
    }

    this.fail(new Error("App-server client closed"));
    this.unsubscribeLine();
    this.unsubscribeExit();
    this.closePromise = this.transport.close();
    return this.closePromise;
  }

  private async initialize(): Promise<void> {
    await this.sendRequest(
      "initialize",
      {
        clientInfo: {
          name: "skill-session-profiles",
          title: "Skill Session Profiles",
          version: "0.1.0",
        },
        capabilities: {
          experimentalApi: true,
          requestAttestation: false,
        },
      },
      DEFAULT_REQUEST_TIMEOUT_MS,
    );

    if (this.terminalError !== undefined) {
      throw this.terminalError;
    }
    try {
      this.transport.write(JSON.stringify({ method: "initialized" }));
    } catch (error) {
      const transportError = toError(error);
      this.fail(transportError);
      throw transportError;
    }
  }

  private sendRequest<T>(
    method: string,
    params: unknown,
    timeoutMs: number,
  ): Promise<T> {
    if (this.terminalError !== undefined) {
      return Promise.reject(this.terminalError);
    }

    const id = this.nextId;
    this.nextId += 1;

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `App-server request timed out after ${timeoutMs}ms: ${method}`,
          ),
        );
      }, timeoutMs);
      this.pending.set(id, {
        method,
        resolve: resolve as (value: unknown) => void,
        reject,
        timer,
      });

      try {
        this.transport.write(JSON.stringify({ method, id, params }));
      } catch (error) {
        clearTimeout(timer);
        this.pending.delete(id);
        const transportError = toError(error);
        this.fail(transportError);
        reject(transportError);
      }
    });
  }

  private handleLine(line: string): void {
    if (this.terminalError !== undefined) {
      return;
    }

    let message: unknown;
    try {
      message = JSON.parse(line);
    } catch {
      this.fail(new Error("App-server returned malformed JSON"));
      return;
    }

    if (!isRecord(message)) {
      return;
    }

    if (
      typeof message.method === "string" &&
      !Object.hasOwn(message, "id")
    ) {
      const listeners = this.notificationListeners.get(message.method);
      if (listeners !== undefined) {
        for (const listener of [...listeners]) {
          listener(message.params);
        }
      }
      return;
    }

    if (typeof message.id !== "number") {
      return;
    }
    const request = this.pending.get(message.id);
    if (request === undefined) {
      return;
    }

    clearTimeout(request.timer);
    this.pending.delete(message.id);
    if (Object.hasOwn(message, "error")) {
      request.reject(rpcError(message.error, request.method));
      return;
    }
    if (Object.hasOwn(message, "result")) {
      request.resolve(message.result);
      return;
    }
    request.reject(
      new Error(`App-server returned an invalid response for ${request.method}`),
    );
  }

  private fail(error: Error): void {
    if (this.terminalError !== undefined) {
      return;
    }
    this.terminalError = error;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rpcError(value: unknown, method: string): Error {
  const error = isRecord(value) ? (value as RpcError) : undefined;
  const message =
    typeof error?.message === "string"
      ? error.message
      : `App-server request failed: ${method}`;
  const result = new Error(message);
  if (typeof error?.code === "number") {
    Object.assign(result, { code: error.code });
  }
  if (error?.data !== undefined) {
    Object.assign(result, { data: error.data });
  }
  return result;
}

function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}
