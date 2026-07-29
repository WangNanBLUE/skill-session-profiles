import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  prepareSharedDataRoot,
  resolveSharedDataRoot,
} from "../src/server/data-root.js";

const temporaryRoots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(temporaryRoots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })));
});

describe("shared desktop and plugin data root", () => {
  it("uses a stable directory under CODEX_HOME", async () => {
    const root = await mkdtemp(join(tmpdir(), "skill-profiles-root-"));
    temporaryRoots.push(root);
    vi.stubEnv("CODEX_HOME", root);
    vi.stubEnv("SKILL_SESSION_PROFILES_DATA", "");

    expect(resolveSharedDataRoot()).toBe(join(root, "skill-session-profiles"));
  });

  it("migrates cached plugin state without overwriting stable state", async () => {
    const root = await mkdtemp(join(tmpdir(), "skill-profiles-migrate-"));
    temporaryRoots.push(root);
    const legacy = join(
      root,
      "plugins",
      "cache",
      "personal",
      "skill-session-profiles",
      "0.1.0+codex.previous",
      ".plugin-data",
    );
    const target = join(root, "shared");
    await mkdir(legacy, { recursive: true });
    await mkdir(target, { recursive: true });
    await writeFile(join(legacy, "profiles.json"), "{\"legacy\":true}\n");
    await writeFile(join(target, "profiles.json"), "{\"stable\":true}\n");
    await writeFile(join(legacy, "pending.json"), "{\"pending\":true}\n");
    vi.stubEnv("CODEX_HOME", root);
    vi.stubEnv("SKILL_SESSION_PROFILES_DATA", target);

    await prepareSharedDataRoot();

    expect(await readFile(join(target, "profiles.json"), "utf8")).toBe("{\"stable\":true}\n");
    expect(await readFile(join(target, "pending.json"), "utf8")).toBe("{\"pending\":true}\n");
  });
});
