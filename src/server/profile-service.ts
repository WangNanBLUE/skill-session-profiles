import { createHash, randomUUID } from "node:crypto";
import { isAbsolute, normalize } from "node:path";

import type { AppServerClient } from "./app-server-client.js";
import { extractUserSkillLayer } from "./config-layer.js";
import { JsonStore } from "./json-store.js";
import {
  skillProfileSchema,
  type PendingFile,
  type SkillConfigEntry,
  type SkillOverride,
  type SkillProfile,
} from "../shared/contracts.js";

export function canonicalize(entries: SkillConfigEntry[]): SkillConfigEntry[] {
  const byPath = new Map<string, SkillConfigEntry>();
  for (const entry of entries) {
    const path = normalize(entry.path);
    if (!isAbsolute(path)) throw new Error(`skill path must be absolute: ${entry.path}`);
    byPath.set(path, { ...entry, path });
  }
  return [...byPath.values()].sort((a, b) => a.path.localeCompare(b.path));
}

export function hashConfig(entries: SkillConfigEntry[]): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(entries))).digest("hex");
}

export function resolveTarget(
  baseline: SkillConfigEntry[],
  overrides: SkillOverride[],
): SkillConfigEntry[] {
  const result = new Map(canonicalize(baseline).map((entry) => [entry.path, entry]));
  for (const override of overrides) {
    const path = normalize(override.path);
    if (!isAbsolute(path)) throw new Error(`skill path must be absolute: ${override.path}`);
    result.set(path, { ...(result.get(path) ?? { path }), enabled: override.state === "enabled" });
  }
  return canonicalize([...result.values()]);
}

export class ProfileService {
  constructor(readonly client: AppServerClient, readonly store: JsonStore) {}

  async listProfiles(): Promise<SkillProfile[]> {
    return (await this.store.readProfiles()).profiles;
  }

  async saveProfile(input: { id?: string; name: string; overrides: SkillOverride[] }): Promise<SkillProfile> {
    return this.store.withLock(async () => {
      const file = await this.store.readProfiles();
      const now = new Date().toISOString();
      const existing = input.id ? file.profiles.find((item) => item.id === input.id) : undefined;
      const profile = skillProfileSchema.parse({
        id: input.id ?? randomUUID(),
        name: input.name,
        overrides: input.overrides,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      });
      file.profiles = [...file.profiles.filter((item) => item.id !== profile.id), profile];
      await this.store.writeProfiles(file);
      return profile;
    });
  }

  async deleteProfile(id: string): Promise<void> {
    await this.store.withLock(async () => {
      const pending = await this.store.readPending();
      if (pending?.profileId === id) throw new Error("armed profile cannot be deleted");
      const file = await this.store.readProfiles();
      file.profiles = file.profiles.filter((profile) => profile.id !== id);
      await this.store.writeProfiles(file);
    });
  }

  async reconcile(): Promise<PendingFile | undefined> {
    return this.store.withLock(async () => {
      const pending = await this.store.readPending();
      if (!pending || pending.state === "conflict") return pending;
      const layer = extractUserSkillLayer(await this.client.readConfig(pending.cwd));
      const currentHash = hashConfig(layer.value);
      if (pending.state === "prepared" && currentHash === pending.baselineHash) {
        await this.store.clearPending();
        return undefined;
      }
      if (currentHash === pending.targetHash) {
        if (pending.state === "prepared") {
          pending.state = "armed";
          pending.expectedVersion = layer.version;
          await this.store.writePending(pending);
          await this.store.appendAudit({ action: "reconciled", result: "armed", cwd: pending.cwd });
        }
        return pending;
      }
      pending.state = "conflict";
      await this.store.writePending(pending);
      await this.store.appendAudit({ action: "reconciled", result: "conflict", cwd: pending.cwd });
      return pending;
    });
  }

  async saveGlobalDefaults(cwd: string, value: SkillConfigEntry[]): Promise<void> {
    await this.requireBatchWrite();
    await this.store.withLock(async () => {
      const inventory = await this.client.listSkills([cwd], true);
      const layer = extractUserSkillLayer(await this.client.readConfig(cwd));
      const allowed = new Set([
        ...inventory.data.flatMap((item) => item.skills.map((skill) => normalize(skill.path))),
        ...layer.value.map((item) => normalize(item.path)),
      ]);
      const normalized = canonicalize(value);
      if (normalized.some((entry) => !allowed.has(entry.path))) throw new Error("unknown skill path");
      await this.client.batchWriteSkillsConfig(normalized, layer.version);
    });
  }

  async applyPersistent(cwd: string, overrides: SkillOverride[]): Promise<SkillConfigEntry[]> {
    await this.requireBatchWrite();
    return this.store.withLock(async () => {
      if (await this.store.readPending()) throw new Error("pending configuration must be restored");
      const inventory = await this.client.listSkills([cwd], true);
      const layer = extractUserSkillLayer(await this.client.readConfig(cwd));
      const allowed = new Set([
        ...inventory.data.flatMap((item) => item.skills.map((skill) => normalize(skill.path))),
        ...layer.value.map((entry) => normalize(entry.path)),
      ]);
      if (overrides.some((override) => !allowed.has(normalize(override.path)))) {
        throw new Error("unknown skill path");
      }
      const target = resolveTarget(layer.value, overrides);
      await this.client.batchWriteSkillsConfig(target, layer.version);
      await this.store.appendAudit({ action: "applied", cwd });
      return target;
    });
  }

  async arm(cwd: string, profileId: string | null, name: string, overrides: SkillOverride[]): Promise<PendingFile> {
    await this.requireBatchWrite();
    return this.store.withLock(async () => {
      if (await this.store.readPending()) throw new Error("another profile is already pending");
      const inventory = await this.client.listSkills([cwd], true);
      const layer = extractUserSkillLayer(await this.client.readConfig(cwd));
      const allowed = new Set([
        ...inventory.data.flatMap((item) => item.skills.map((skill) => normalize(skill.path))),
        ...layer.value.map((entry) => normalize(entry.path)),
      ]);
      if (overrides.some((override) => !allowed.has(normalize(override.path)))) {
        throw new Error("unknown skill path");
      }
      const baseline = canonicalize(layer.value);
      const target = resolveTarget(baseline, overrides);
      const pending: PendingFile = {
        schemaVersion: 1, state: "prepared", profileId, profileName: name, cwd,
        baseline, target, baselineHash: hashConfig(baseline), targetHash: hashConfig(target),
        expectedVersion: layer.version, armedAt: new Date().toISOString(),
      };
      await this.store.writePending(pending);
      try {
        await this.client.batchWriteSkillsConfig(target, layer.version);
        const current = extractUserSkillLayer(await this.client.readConfig(cwd));
        if (hashConfig(current.value) !== pending.targetHash) throw new Error("target verification failed");
        pending.state = "armed";
        pending.expectedVersion = current.version;
        await this.store.writePending(pending);
        await this.store.appendAudit({ action: "armed", profileId, cwd });
        return pending;
      } catch (error) {
        const current = extractUserSkillLayer(await this.client.readConfig(cwd));
        if (hashConfig(current.value) === pending.baselineHash) await this.store.clearPending();
        throw error;
      }
    });
  }

  async restore(consumerSessionId?: string): Promise<{ restored: boolean; conflictPaths?: string[] }> {
    await this.requireBatchWrite();
    return this.store.withLock(async () => {
      const pending = await this.store.readPending();
      if (!pending) return { restored: false };
      const layer = extractUserSkillLayer(await this.client.readConfig(pending.cwd));
      const currentHash = hashConfig(layer.value);
      if (pending.state === "prepared" && currentHash === pending.baselineHash) {
        await this.store.clearPending();
        return { restored: false };
      }
      if (currentHash !== pending.targetHash) {
        pending.state = "conflict";
        await this.store.writePending(pending);
        const baseline = new Map(pending.baseline.map((x) => [x.path, x.enabled]));
        const target = new Map(pending.target.map((x) => [x.path, x.enabled]));
        const current = new Map(canonicalize(layer.value).map((x) => [x.path, x.enabled]));
        const paths = new Set([...baseline.keys(), ...target.keys(), ...current.keys()]);
        return { restored: false, conflictPaths: [...paths].filter((p) => current.get(p) !== target.get(p)) };
      }
      if (consumerSessionId) pending.consumerSessionId = consumerSessionId;
      await this.client.batchWriteSkillsConfig(pending.baseline, layer.version);
      const restored = extractUserSkillLayer(await this.client.readConfig(pending.cwd));
      if (hashConfig(restored.value) !== pending.baselineHash) throw new Error("baseline verification failed");
      await this.store.appendAudit({ action: "restored", consumerSessionId });
      await this.store.clearPending();
      return { restored: true };
    });
  }

  private async requireBatchWrite(): Promise<void> {
    if (!(await this.client.canBatchWrite())) {
      throw new Error("config/batchWrite is unavailable; skill configuration is read-only");
    }
  }
}
