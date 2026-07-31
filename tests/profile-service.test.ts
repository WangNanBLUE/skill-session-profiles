import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppServerClient } from "../src/server/app-server-client.js";
import { JsonStore } from "../src/server/json-store.js";
import { canonicalize, ProfileService, resolveTarget } from "../src/server/profile-service.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fakeClient(paths = ["/skills/a/SKILL.md"]) {
  const readConfig = vi.fn().mockResolvedValue({
    config: {}, origins: {},
    layers: [
      { name: { type: "user", profile: null }, version: "v1", config: {
        skills: { config: [{ path: "/skills/a/SKILL.md", enabled: false }] },
      } },
      { name: { type: "project", dotCodexFolder: "/repo/.codex" }, version: "project-v1", config: {
        skills: { config: [] },
      } },
    ],
  });
  return {
    listSkills: vi.fn().mockResolvedValue({ data: [{ cwd: "/repo", skills: paths.map((path) => ({
      path, name: path, description: "", scope: "user", enabled: true,
    })), errors: [] }] }),
    readConfig,
    batchWriteSkillsConfig: vi.fn(),
    readFile: vi.fn().mockResolvedValue("# Existing project guidance\n"),
    writeFile: vi.fn(),
    readDirectory: vi.fn().mockResolvedValue([
      { fileName: "AGENTS.md", isDirectory: false, isFile: true },
    ]),
    createDirectory: vi.fn(),
    canBatchWrite: vi.fn().mockResolvedValue(true),
  } as unknown as AppServerClient;
}

async function service(client = fakeClient()) {
  const root = await mkdtemp(join(tmpdir(), "skill-profiles-"));
  roots.push(root);
  const store = new JsonStore(root);
  return { store, service: new ProfileService(client, store), client };
}

describe("profile resolution", () => {
  it("canonicalizes by absolute path and applies only explicit overrides", () => {
    expect(resolveTarget(
      [{ path: "/skills/a/SKILL.md", enabled: false }],
      [{ path: "/skills/a/SKILL.md", state: "enabled" }, { path: "/skills/b/SKILL.md", state: "disabled" }],
    )).toEqual([
      { path: "/skills/a/SKILL.md", enabled: true },
      { path: "/skills/b/SKILL.md", enabled: false },
    ]);
  });

  it("preserves name-based selectors while applying path overrides", () => {
    expect(resolveTarget(
      [
        { name: "skill-creator", enabled: false },
        { path: "/skills/a/SKILL.md", enabled: false },
      ],
      [{ path: "/skills/a/SKILL.md", state: "enabled" }],
    )).toEqual([
      { name: "skill-creator", enabled: false },
      { path: "/skills/a/SKILL.md", enabled: true },
    ]);
  });

  it("persists profile overrides", async () => {
    const setup = await service();
    await expect(setup.service.applyPersistent("/repo", [
      { path: "/skills/a/SKILL.md", state: "enabled" },
    ], "p1")).resolves.toEqual([
      { path: "/skills/a/SKILL.md", enabled: true },
    ]);
    expect(setup.client.batchWriteSkillsConfig).toHaveBeenCalledWith([
      { path: "/skills/a/SKILL.md", enabled: true },
    ], "v1");
    expect(await setup.store.readProfiles()).toMatchObject({ activeProfileId: "p1" });
  });

  it("writes project overrides to AGENTS.md without replacing existing guidance", async () => {
    const setup = await service();
    await expect(setup.service.saveProjectConfiguration("/repo", [
      { path: "/skills/a/SKILL.md", state: "disabled" },
    ])).resolves.toEqual([
      { path: "/skills/a/SKILL.md", enabled: false },
    ]);
    expect(setup.client.writeFile).toHaveBeenCalledWith(
      "/repo/AGENTS.md",
      expect.any(String),
    );
    const [filePath, source] = vi.mocked(setup.client.writeFile).mock.calls[0];
    expect(filePath).toBe("/repo/AGENTS.md");
    expect(source).toContain("# Existing project guidance");
    expect(source).toContain("- Do not invoke or read");
    expect(source).toContain("`/skills/a/SKILL.md`");
    expect(setup.client.batchWriteSkillsConfig).not.toHaveBeenCalled();
  });

});
