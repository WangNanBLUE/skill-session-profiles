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

    await expect(resolveCodexCommand("win32")).resolves.toBe(command);
  });
});
