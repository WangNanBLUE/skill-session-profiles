import { afterEach, describe, expect, it, vi } from "vitest";

const fsMocks = vi.hoisted(() => ({
  access: vi.fn(),
  readdir: vi.fn(),
}));

vi.mock("node:fs/promises", () => fsMocks);

import { resolveCodexCommand } from "../src/electron/codex-command.js";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});

describe("resolveCodexCommand", () => {
  it("finds the Codex binary bundled with the system ChatGPT app", async () => {
    const bundledCodex = "/Applications/ChatGPT.app/Contents/Resources/codex";
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });

    vi.stubEnv("PATH", "/usr/bin:/bin");
    vi.stubEnv("CODEX_BINARY", "");
    vi.stubEnv("CODEX_BIN", "");
    fsMocks.access.mockImplementation(async (candidate: string) => {
      if (candidate === bundledCodex) return;
      throw missing;
    });
    fsMocks.readdir.mockRejectedValue(missing);

    await expect(resolveCodexCommand()).resolves.toBe(bundledCodex);
  });

  it("finds an npm Codex command shim on Windows", async () => {
    const command = "C:\\Users\\blue\\AppData\\Roaming\\npm\\codex.cmd";
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });

    vi.stubEnv("PATH", "C:\\Users\\blue\\AppData\\Roaming\\npm");
    vi.stubEnv("CODEX_BINARY", "");
    vi.stubEnv("CODEX_BIN", "");
    fsMocks.access.mockImplementation(async (candidate: string) => {
      if (candidate === command) return;
      throw missing;
    });
    fsMocks.readdir.mockRejectedValue(missing);

    await expect(resolveCodexCommand("win32", "x64")).resolves.toBe(command);
  });

  it("finds the native npm Codex binary when the GUI PATH omits npm", async () => {
    const command = [
      "C:\\Users\\blue\\AppData\\Roaming\\npm\\node_modules",
      "@openai\\codex\\node_modules\\@openai\\codex-win32-x64",
      "vendor\\x86_64-pc-windows-msvc\\bin\\codex.exe",
    ].join("\\");
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });

    vi.stubEnv("PATH", "C:\\Windows\\System32");
    vi.stubEnv("APPDATA", "C:\\Users\\blue\\AppData\\Roaming");
    vi.stubEnv("LOCALAPPDATA", "C:\\Users\\blue\\AppData\\Local");
    vi.stubEnv("CODEX_BINARY", "");
    vi.stubEnv("CODEX_BIN", "");
    fsMocks.access.mockImplementation(async (candidate: string) => {
      if (candidate === command) return;
      throw missing;
    });
    fsMocks.readdir.mockRejectedValue(missing);

    await expect(resolveCodexCommand("win32", "x64")).resolves.toBe(command);
  });

  it("finds the Codex desktop cache when no standalone CLI is installed", async () => {
    const cacheRoot = "C:\\Users\\blue\\AppData\\Local\\OpenAI\\Codex\\bin";
    const command = `${cacheRoot}\\release-id\\codex.exe`;
    const missing = Object.assign(new Error("missing"), { code: "ENOENT" });

    vi.stubEnv("PATH", "C:\\Windows\\System32");
    vi.stubEnv("APPDATA", "C:\\Users\\blue\\AppData\\Roaming");
    vi.stubEnv("LOCALAPPDATA", "C:\\Users\\blue\\AppData\\Local");
    vi.stubEnv("CODEX_BINARY", "");
    vi.stubEnv("CODEX_BIN", "");
    fsMocks.access.mockImplementation(async (candidate: string) => {
      if (candidate === command) return;
      throw missing;
    });
    fsMocks.readdir.mockImplementation(async (root: string) => {
      if (root === cacheRoot) {
        return [{ name: "release-id", isDirectory: () => true }];
      }
      throw missing;
    });

    await expect(resolveCodexCommand("win32", "x64")).resolves.toBe(command);
  });
});
