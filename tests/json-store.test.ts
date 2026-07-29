import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { JsonStore } from "../src/server/json-store.js";

const roots: string[] = [];

async function createStore() {
  const root = await mkdtemp(join(tmpdir(), "skill-profiles-"));
  roots.push(root);
  return new JsonStore(root);
}

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("JsonStore", () => {
  it("atomically persists and validates profiles", async () => {
    const store = await createStore();
    const value = {
      schemaVersion: 1 as const,
      profiles: [{
        id: "p1", name: "Daily", overrides: [],
        createdAt: "2026-07-28T00:00:00.000Z",
        updatedAt: "2026-07-28T00:00:00.000Z",
      }],
    };
    await store.writeProfiles(value);
    expect(await store.readProfiles()).toEqual(value);
    expect(JSON.parse(await readFile(join(store.root, "profiles.json"), "utf8"))).toEqual(value);
  });

  it("rejects invalid JSON and unknown schema versions", async () => {
    const store = await createStore();
    await mkdir(store.root, { recursive: true });
    await writeFile(join(store.root, "profiles.json"), "{");
    await expect(store.readProfiles()).rejects.toThrow();
    await writeFile(join(store.root, "profiles.json"), JSON.stringify({ schemaVersion: 2, profiles: [] }));
    await expect(store.readProfiles()).rejects.toThrow();
  });

  it("rejects a second mutation while the lock is held", async () => {
    const store = await createStore();
    await store.withLock(async () => {
      await expect(store.withLock(async () => undefined)).rejects.toThrow("operation already in progress");
    });
  });

  it("rotates audit storage before it grows beyond the bounded size", async () => {
    const store = await createStore();
    for (let index = 0; index < 8; index += 1) {
      await store.appendAudit({ action: "test", payload: "x".repeat(40_000) });
    }
    expect((await stat(join(store.root, "audit.jsonl"))).size).toBeLessThan(262_144);
    expect((await stat(join(store.root, "audit.1.jsonl"))).size).toBeGreaterThan(0);
  });
});
