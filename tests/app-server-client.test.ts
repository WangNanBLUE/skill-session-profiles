import { afterEach, describe, expect, it, vi } from "vitest";

import {
  AppServerClient,
  codexAppServerInvocation,
  type LineTransport,
} from "../src/server/app-server-client.js";

describe("codexAppServerInvocation", () => {
  it("runs Windows npm command shims through cmd.exe", () => {
    expect(codexAppServerInvocation("C:\\npm\\codex.cmd", "win32", "cmd.exe"))
      .toEqual({
        command: "cmd.exe",
        args: ["/d", "/s", "/c", '"C:\\npm\\codex.cmd" app-server --stdio'],
        windowsVerbatimArguments: true,
      });
  });

  it("launches native executables directly", () => {
    expect(codexAppServerInvocation("C:\\bin\\codex.exe", "win32"))
      .toEqual({
        command: "C:\\bin\\codex.exe",
        args: ["app-server", "--stdio"],
      });
  });
});

class FakeLineTransport implements LineTransport {
  readonly writes: string[] = [];
  closeCalls = 0;

  private readonly lineListeners = new Set<(line: string) => void>();
  private readonly exitListeners = new Set<(error: Error) => void>();

  write(message: string): void {
    this.writes.push(message);
  }

  onLine(listener: (line: string) => void): () => void {
    this.lineListeners.add(listener);
    return () => {
      this.lineListeners.delete(listener);
    };
  }

  onExit(listener: (error: Error) => void): () => void {
    this.exitListeners.add(listener);
    return () => {
      this.exitListeners.delete(listener);
    };
  }

  async close(): Promise<void> {
    this.closeCalls += 1;
  }

  emitLine(message: unknown): void {
    const line =
      typeof message === "string" ? message : JSON.stringify(message);
    for (const listener of this.lineListeners) {
      listener(line);
    }
  }

  emitExit(error: Error): void {
    for (const listener of this.exitListeners) {
      listener(error);
    }
  }

  messages(): Array<Record<string, unknown>> {
    return this.writes.map(
      (message) => JSON.parse(message) as Record<string, unknown>,
    );
  }
}

async function createInitializedClient(): Promise<{
  client: AppServerClient;
  transport: FakeLineTransport;
}> {
  const transport = new FakeLineTransport();
  const client = new AppServerClient(transport);
  const initialize = transport.messages()[0];

  expect(initialize).toMatchObject({
    method: "initialize",
    params: {
      clientInfo: {
        name: "skill-session-profiles",
      },
      capabilities: {
        experimentalApi: true,
        requestAttestation: false,
      },
    },
  });

  transport.emitLine({ id: initialize.id, result: {} });
  await vi.waitFor(() => {
    expect(transport.messages()[1]).toEqual({ method: "initialized" });
  });

  return { client, transport };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("AppServerClient", () => {
  it("completes the initialize handshake before sending application requests", async () => {
    const transport = new FakeLineTransport();
    const client = new AppServerClient(transport);
    const response = client.request("example/read", { value: 7 });

    expect(transport.messages()).toHaveLength(1);
    expect(transport.messages()[0]).toMatchObject({
      method: "initialize",
      params: {
        clientInfo: {
          name: "skill-session-profiles",
          title: "Skill Session Profiles",
          version: "0.1.0",
        },
      },
    });

    transport.emitLine({
      id: transport.messages()[0].id,
      result: { userAgent: "test" },
    });

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    expect(transport.messages()[1]).toEqual({ method: "initialized" });
    expect(transport.messages()[2]).toMatchObject({
      method: "example/read",
      params: { value: 7 },
    });

    transport.emitLine({
      id: transport.messages()[2].id,
      result: { ok: true },
    });
    await expect(response).resolves.toEqual({ ok: true });

    await client.close();
  });

  it("correlates concurrent responses by request id", async () => {
    const { client, transport } = await createInitializedClient();
    const first = client.request<string>("example/first", {});
    const second = client.request<string>("example/second", {});

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(4);
    });
    const firstRequest = transport.messages()[2];
    const secondRequest = transport.messages()[3];

    transport.emitLine({ id: secondRequest.id, result: "second result" });
    transport.emitLine({ id: firstRequest.id, result: "first result" });

    await expect(first).resolves.toBe("first result");
    await expect(second).resolves.toBe("second result");
    await client.close();
  });

  it("delivers notifications until the listener unsubscribes", async () => {
    const { client, transport } = await createInitializedClient();
    const listener = vi.fn();
    const unsubscribe = client.onNotification("skills/changed", listener);

    transport.emitLine({
      method: "skills/changed",
      params: { paths: ["/one"] },
    });
    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenLastCalledWith({ paths: ["/one"] });

    unsubscribe();
    transport.emitLine({
      method: "skills/changed",
      params: { paths: ["/two"] },
    });
    expect(listener).toHaveBeenCalledOnce();
    await client.close();
  });

  it("rejects every pending request when the transport exits", async () => {
    const { client, transport } = await createInitializedClient();
    const first = client.request("example/first", {});
    const second = client.request("example/second", {});
    const exitError = new Error("proxy exited");

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(4);
    });
    transport.emitExit(exitError);

    await expect(first).rejects.toBe(exitError);
    await expect(second).rejects.toBe(exitError);
  });

  it("treats malformed JSON as a fatal protocol error", async () => {
    const { client, transport } = await createInitializedClient();
    const pending = client.request("example/read", {});

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    transport.emitLine("{not json");

    await expect(pending).rejects.toThrow(/malformed JSON/i);
    await expect(client.request("example/again", {})).rejects.toThrow(
      /malformed JSON/i,
    );
  });

  it("rejects a request when its timeout expires", async () => {
    vi.useFakeTimers();
    const { client } = await createInitializedClient();
    const pending = client.request("example/slow", {}, 50);
    const rejection = expect(pending).rejects.toThrow(
      /timed out.*example\/slow/i,
    );

    await vi.advanceTimersByTimeAsync(50);

    await rejection;
    await client.close();
  });

  it("close rejects pending requests and closes the transport", async () => {
    const { client, transport } = await createInitializedClient();
    const pending = client.request("example/read", {});

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    await client.close();

    await expect(pending).rejects.toThrow(/closed/i);
    expect(transport.closeCalls).toBe(1);
    await expect(client.request("example/again", {})).rejects.toThrow(/closed/i);
  });

  it("turns app-server error responses into rejected requests", async () => {
    const { client, transport } = await createInitializedClient();
    const pending = client.request("example/read", {});

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    transport.emitLine({
      id: transport.messages()[2].id,
      error: { code: -32602, message: "invalid params" },
    });

    await expect(pending).rejects.toThrow(/invalid params/);
    await client.close();
  });

  it("calls skills/list with the requested working directories", async () => {
    const { client, transport } = await createInitializedClient();
    const pending = client.listSkills(["/repo/a", "/repo/b"], true);

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    expect(transport.messages()[2]).toMatchObject({
      method: "skills/list",
      params: {
        cwds: ["/repo/a", "/repo/b"],
        forceReload: true,
      },
    });
    transport.emitLine({
      id: transport.messages()[2].id,
      result: { data: [] },
    });

    await expect(pending).resolves.toEqual({ data: [] });
    await client.close();
  });

  it("lists installed plugins through the experimental plugin API", async () => {
    const { client, transport } = await createInitializedClient();
    const pending = client.listPlugins();

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    expect(transport.messages()[2]).toMatchObject({
      method: "plugin/list",
      params: {
        cursor: null,
        limit: 200,
      },
    });
    transport.emitLine({
      id: transport.messages()[2].id,
      result: { marketplaces: [], nextCursor: null },
    });

    await expect(pending).resolves.toEqual({
      marketplaces: [],
      nextCursor: null,
    });
    await client.close();
  });

  it("reads config layers and only sends cwd when provided", async () => {
    const { client, transport } = await createInitializedClient();
    const withoutCwd = client.readConfig();

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    expect(transport.messages()[2]).toMatchObject({
      method: "config/read",
      params: { includeLayers: true },
    });
    expect(transport.messages()[2].params).not.toHaveProperty("cwd");
    transport.emitLine({
      id: transport.messages()[2].id,
      result: { config: {}, origins: {}, layers: [] },
    });
    await withoutCwd;

    const withCwd = client.readConfig("/repo");
    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(4);
    });
    expect(transport.messages()[3]).toMatchObject({
      method: "config/read",
      params: { includeLayers: true, cwd: "/repo" },
    });
    transport.emitLine({
      id: transport.messages()[3].id,
      result: { config: {}, origins: {}, layers: [] },
    });

    await withCwd;
    await client.close();
  });

  it("atomically replaces skills.config without hot reloading tasks", async () => {
    const { client, transport } = await createInitializedClient();
    const value = [
      { path: "/skills/one", enabled: true, name: "one" },
      { path: "/skills/two", enabled: false },
    ];
    const pending = client.batchWriteSkillsConfig(value, "version-1");

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    expect(transport.messages()[2]).toMatchObject({
      method: "config/batchWrite",
      params: {
        edits: [
          {
            keyPath: "skills.config",
            value,
            mergeStrategy: "replace",
          },
        ],
        expectedVersion: "version-1",
        reloadUserConfig: false,
      },
    });
    transport.emitLine({
      id: transport.messages()[2].id,
      result: {
        status: "ok",
        version: "version-2",
        filePath: "/user/config.toml",
        overriddenMetadata: null,
      },
    });

    await expect(pending).resolves.toMatchObject({
      status: "ok",
      version: "version-2",
    });
    await client.close();
  });

  it("writes resource enabled fields with the current config version", async () => {
    const { client, transport } = await createInitializedClient();
    const pending = client.batchWriteResourceConfig("plugins", [
      { id: "browser@openai-bundled", enabled: false },
      { id: "github", enabled: true },
    ], "version-7");

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    expect(transport.messages()[2]).toMatchObject({
      method: "config/batchWrite",
      params: {
        edits: [
          {
            keyPath: 'plugins."browser@openai-bundled".enabled',
            value: false,
            mergeStrategy: "upsert",
          },
          {
            keyPath: 'plugins."github".enabled',
            value: true,
            mergeStrategy: "upsert",
          },
        ],
        expectedVersion: "version-7",
        reloadUserConfig: true,
      },
    });
    transport.emitLine({
      id: transport.messages()[2].id,
      result: {
        status: "ok",
        version: "version-8",
        filePath: "/user/config.toml",
        overriddenMetadata: null,
      },
    });

    await expect(pending).resolves.toMatchObject({ version: "version-8" });
    await client.close();
  });

  it("reloads MCP servers after configuration changes", async () => {
    const { client, transport } = await createInitializedClient();
    const pending = client.reloadMcpServers();

    await vi.waitFor(() => {
      expect(transport.messages()).toHaveLength(3);
    });
    expect(transport.messages()[2]).toMatchObject({
      method: "config/mcpServer/reload",
      params: {},
    });
    transport.emitLine({ id: transport.messages()[2].id, result: {} });

    await expect(pending).resolves.toEqual({});
    await client.close();
  });

  it("reads and writes project config through the filesystem API", async () => {
    const { client, transport } = await createInitializedClient();
    const read = client.readFile("/repo/.codex/config.toml");
    await vi.waitFor(() => expect(transport.messages()).toHaveLength(3));
    expect(transport.messages()[2]).toMatchObject({
      method: "fs/readFile",
      params: { path: "/repo/.codex/config.toml" },
    });
    transport.emitLine({
      id: transport.messages()[2].id,
      result: { dataBase64: Buffer.from('model = "gpt-5"\n').toString("base64") },
    });
    await expect(read).resolves.toBe('model = "gpt-5"\n');

    const write = client.writeFile("/repo/.codex/config.toml", "enabled = true\n");
    await vi.waitFor(() => expect(transport.messages()).toHaveLength(4));
    expect(transport.messages()[3]).toMatchObject({
      method: "fs/writeFile",
      params: {
        path: "/repo/.codex/config.toml",
        dataBase64: Buffer.from("enabled = true\n").toString("base64"),
      },
    });
    transport.emitLine({ id: transport.messages()[3].id, result: {} });
    await write;

    const readDirectory = client.readDirectory("/repo/.codex");
    await vi.waitFor(() => expect(transport.messages()).toHaveLength(5));
    expect(transport.messages()[4]).toMatchObject({
      method: "fs/readDirectory",
      params: { path: "/repo/.codex" },
    });
    transport.emitLine({
      id: transport.messages()[4].id,
      result: {
        entries: [{ fileName: "config.toml", isDirectory: false, isFile: true }],
      },
    });
    await expect(readDirectory).resolves.toEqual([
      { fileName: "config.toml", isDirectory: false, isFile: true },
    ]);
    await client.close();
  });

  it.each([
    [-32600, true],
    [-32602, true],
    [-32601, false],
  ])("probes config/batchWrite without sending edits (%s)", async (code, expected) => {
    const { client, transport } = await createInitializedClient();
    const pending = client.canBatchWrite();
    await vi.waitFor(() => expect(transport.messages()).toHaveLength(3));
    expect(transport.messages()[2]).toMatchObject({
      method: "config/batchWrite",
      params: {},
    });
    transport.emitLine({ id: transport.messages()[2].id, error: { code, message: "probe" } });
    await expect(pending).resolves.toBe(expected);
    await client.close();
  });
});
