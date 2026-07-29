import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppServerClient } from "../src/server/app-server-client.js";
import { JsonStore } from "../src/server/json-store.js";
import { canonicalize, hashConfig, ProfileService, resolveTarget } from "../src/server/profile-service.js";

const roots: string[] = [];
afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

function fakeClient(paths = ["/skills/a/SKILL.md"]) {
  const readConfig = vi.fn().mockResolvedValue({
    config: {}, origins: {},
    layers: [{ name: { type: "user", profile: null }, version: "v1", config: {
      skills: { config: [{ path: "/skills/a/SKILL.md", enabled: false }] },
    } }],
  });
  return {
    listSkills: vi.fn().mockResolvedValue({ data: [{ cwd: "/repo", skills: paths.map((path) => ({
      path, name: path, description: "", scope: "user", enabled: true,
    })), errors: [] }] }),
    readConfig,
    batchWriteSkillsConfig: vi.fn(),
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
    expect(hashConfig(canonicalize([{ path: "/skills/a/SKILL.md", enabled: false }]))).toHaveLength(64);
  });

  it("rejects an arm override outside the current inventory and user layer", async () => {
    const { service: profiles } = await service();
    await expect(profiles.arm("/repo", null, "Unsafe", [
      { path: "/unknown/SKILL.md", state: "enabled" },
    ])).rejects.toThrow("unknown skill path");
  });

  it("persists profile overrides without creating a pending transaction", async () => {
    const setup = await service();
    await expect(setup.service.applyPersistent("/repo", [
      { path: "/skills/a/SKILL.md", state: "enabled" },
    ])).resolves.toEqual([
      { path: "/skills/a/SKILL.md", enabled: true },
    ]);
    expect(setup.client.batchWriteSkillsConfig).toHaveBeenCalledWith([
      { path: "/skills/a/SKILL.md", enabled: true },
    ], "v1");
    expect(await setup.store.readPending()).toBeUndefined();
  });

  it("promotes a prepared transaction when the target was committed", async () => {
    const client = fakeClient() as unknown as {
      readConfig: ReturnType<typeof vi.fn>;
    };
    client.readConfig.mockResolvedValue({
      config: {}, origins: {},
      layers: [{ name: { type: "user", profile: null }, version: "v2", config: {
        skills: { config: [{ path: "/skills/a/SKILL.md", enabled: true }] },
      } }],
    });
    const setup = await service(client as unknown as AppServerClient);
    const baseline = [{ path: "/skills/a/SKILL.md", enabled: false }];
    const target = [{ path: "/skills/a/SKILL.md", enabled: true }];
    await setup.store.writePending({
      schemaVersion: 1, state: "prepared", profileId: null, profileName: "Daily", cwd: "/repo",
      baseline, target, baselineHash: hashConfig(baseline), targetHash: hashConfig(target),
      expectedVersion: "v1", armedAt: "2026-07-28T00:00:00.000Z",
    });
    await setup.service.reconcile();
    expect(await setup.store.readPending()).toMatchObject({ state: "armed", expectedVersion: "v2" });
  });
});
