import { mkdtemp, rm } from "node:fs/promises";
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

describe("desktop data root", () => {
  it("uses a stable directory under CODEX_HOME", async () => {
    const root = await mkdtemp(join(tmpdir(), "skill-profiles-root-"));
    temporaryRoots.push(root);
    vi.stubEnv("CODEX_HOME", root);
    vi.stubEnv("SKILL_SESSION_PROFILES_DATA", "");

    expect(resolveSharedDataRoot()).toBe(join(root, "skill-session-profiles"));
  });
});
