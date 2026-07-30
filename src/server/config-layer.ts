import { join, normalize } from "node:path";

import type { ConfigReadResponse, SkillConfigEntry } from "../shared/contracts.js";

export interface UserSkillLayer {
  value: SkillConfigEntry[];
  version: string;
}

function extractSkillConfig(config: unknown): SkillConfigEntry[] {
  const value = (config as { skills?: { config?: unknown } }).skills?.config;
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("skills.config is not an array");
  return value.map((entry) => {
    const item = entry as Partial<SkillConfigEntry>;
    if (typeof item.path !== "string" || typeof item.enabled !== "boolean") {
      throw new Error("invalid skills.config entry");
    }
    return { path: item.path, enabled: item.enabled, ...(item.name ? { name: item.name } : {}) };
  });
}

export function extractUserSkillLayer(response: ConfigReadResponse): UserSkillLayer {
  const layer = response.layers?.find(
    ({ name }) => name.type === "user" && (name.profile ?? null) === null,
  );
  if (layer === undefined) throw new Error("base user config layer is unavailable");
  return {
    value: extractSkillConfig(layer.config),
    version: layer.version,
  };
}

export function extractProjectSkillLayer(response: ConfigReadResponse, cwd: string) {
  const layers = (response.layers ?? [])
    .filter(({ name, disabledReason }) =>
      name.type === "project"
      && name.dotCodexFolder
      && disabledReason == null)
    .sort((a, b) => b.name.dotCodexFolder!.length - a.name.dotCodexFolder!.length);
  const layer = layers[0];
  return {
    value: layer ? extractSkillConfig(layer.config) : [],
    version: layer?.version ?? null,
    filePath: join(layer?.name.dotCodexFolder ?? join(normalize(cwd), ".codex"), "config.toml"),
  };
}
