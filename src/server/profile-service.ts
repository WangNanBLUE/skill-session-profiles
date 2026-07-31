import { randomUUID } from "node:crypto";
import { basename, dirname, isAbsolute, join, normalize } from "node:path";

import type { AppServerClient } from "./app-server-client.js";
import { extractProjectSkillLayer, extractUserSkillLayer } from "./config-layer.js";
import { JsonStore } from "./json-store.js";
import { replaceProjectSkillConfig } from "./project-config.js";
import {
  skillProfileSchema,
  type SkillConfigEntry,
  type SkillOverride,
  type SkillProfile,
} from "../shared/contracts.js";

export function canonicalize(entries: SkillConfigEntry[]): SkillConfigEntry[] {
  const bySelector = new Map<string, SkillConfigEntry>();
  for (const entry of entries) {
    if (entry.path !== undefined) {
      const normalized = normalize(entry.path);
      const path = basename(normalized) === "SKILL.md"
        ? normalized
        : join(normalized, "SKILL.md");
      if (!isAbsolute(path)) throw new Error(`skill path must be absolute: ${entry.path}`);
      bySelector.set(`path:${path}`, { ...entry, path });
    } else {
      bySelector.set(`name:${entry.name}`, entry);
    }
  }
  return [...bySelector.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, entry]) => entry);
}

export function resolveTarget(
  baseline: SkillConfigEntry[],
  overrides: SkillOverride[],
): SkillConfigEntry[] {
  const result = new Map(canonicalize(baseline).map((entry) => [
    entry.path === undefined ? `name:${entry.name}` : `path:${entry.path}`,
    entry,
  ]));
  for (const override of overrides) {
    const normalized = normalize(override.path);
    const path = basename(normalized) === "SKILL.md"
      ? normalized
      : join(normalized, "SKILL.md");
    if (!isAbsolute(path)) throw new Error(`skill path must be absolute: ${override.path}`);
    result.set(`path:${path}`, {
      ...(result.get(`path:${path}`) ?? { path }),
      enabled: override.state === "enabled",
    });
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
      const file = await this.store.readProfiles();
      file.profiles = file.profiles.filter((profile) => profile.id !== id);
      await this.store.writeProfiles(file);
    });
  }

  async saveGlobalDefaults(cwd: string, value: SkillConfigEntry[]): Promise<void> {
    await this.requireBatchWrite();
    await this.store.withLock(async () => {
      const inventory = await this.client.listSkills([cwd], true);
      const layer = extractUserSkillLayer(await this.client.readConfig(cwd));
      const allowed = new Set(canonicalize([
        ...inventory.data.flatMap((item) => item.skills.map((skill) => ({
          path: skill.path, enabled: skill.enabled,
        }))),
        ...layer.value,
      ]).flatMap((entry) => entry.path === undefined ? [] : [entry.path]));
      const normalized = canonicalize([
        ...layer.value.filter((entry) => entry.path === undefined),
        ...value,
      ]);
      if (normalized.some((entry) => entry.path !== undefined && !allowed.has(entry.path))) {
        throw new Error("unknown skill path");
      }
      await this.client.batchWriteSkillsConfig(normalized, layer.version);
    });
  }

  async applyPersistent(cwd: string, overrides: SkillOverride[]): Promise<SkillConfigEntry[]> {
    await this.requireBatchWrite();
    return this.store.withLock(async () => {
      const inventory = await this.client.listSkills([cwd], true);
      const layer = extractUserSkillLayer(await this.client.readConfig(cwd));
      const allowed = new Set(canonicalize([
        ...inventory.data.flatMap((item) => item.skills.map((skill) => ({
          path: skill.path, enabled: skill.enabled,
        }))),
        ...layer.value,
      ]).flatMap((entry) => entry.path === undefined ? [] : [entry.path]));
      if (overrides.some((override) => !allowed.has(canonicalize([
        { path: override.path, enabled: true },
      ])[0].path!))) {
        throw new Error("unknown skill path");
      }
      const target = resolveTarget(layer.value, overrides);
      await this.client.batchWriteSkillsConfig(target, layer.version);
      await this.store.appendAudit({ action: "applied", cwd });
      return target;
    });
  }

  async saveProjectConfiguration(cwd: string, overrides: SkillOverride[]): Promise<SkillConfigEntry[]> {
    return this.store.withLock(async () => {
      const inventory = await this.client.listSkills([cwd], true);
      const layer = extractProjectSkillLayer(await this.client.readConfig(cwd), cwd);
      const allowed = new Set(canonicalize([
        ...inventory.data.flatMap((item) => item.skills.map((skill) => ({
          path: skill.path, enabled: skill.enabled,
        }))),
        ...layer.value,
      ]).flatMap((entry) => entry.path === undefined ? [] : [entry.path]));
      if (overrides.some((override) => !allowed.has(canonicalize([
        { path: override.path, enabled: true },
      ])[0].path!))) {
        throw new Error("unknown skill path");
      }
      const value = canonicalize([
        ...layer.value.filter((entry) => entry.path === undefined),
        ...overrides.map(({ path, state }) => ({
          path,
          enabled: state === "enabled",
        })),
      ]);
      const directory = dirname(layer.filePath);
      await this.client.createDirectory(directory);
      const entries = await this.client.readDirectory(directory);
      const source = entries.some((entry) =>
        entry.fileName === basename(layer.filePath) && entry.isFile)
        ? await this.client.readFile(layer.filePath)
        : "";
      const updated = replaceProjectSkillConfig(source, value);
      await this.client.writeFile(layer.filePath, updated);
      await this.store.appendAudit({ action: "project-config-saved", cwd });
      return value;
    });
  }

  private async requireBatchWrite(): Promise<void> {
    if (!(await this.client.canBatchWrite())) {
      throw new Error("config/batchWrite is unavailable; skill configuration is read-only");
    }
  }
}
