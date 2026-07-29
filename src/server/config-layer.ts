import type { ConfigReadResponse, SkillConfigEntry } from "../shared/contracts.js";

export interface UserSkillLayer {
  value: SkillConfigEntry[];
  version: string;
}

export function extractUserSkillLayer(response: ConfigReadResponse): UserSkillLayer {
  const layer = response.layers?.find(
    ({ name }) => name.type === "user" && (name.profile ?? null) === null,
  );
  if (layer === undefined) throw new Error("base user config layer is unavailable");
  const config = layer.config as { skills?: { config?: unknown } };
  const value = config.skills?.config;
  if (value === undefined) return { value: [], version: layer.version };
  if (!Array.isArray(value)) throw new Error("user skills.config is not an array");
  return {
    value: value.map((entry) => {
      const item = entry as Partial<SkillConfigEntry>;
      if (typeof item.path !== "string" || typeof item.enabled !== "boolean") {
        throw new Error("invalid user skills.config entry");
      }
      return { path: item.path, enabled: item.enabled, ...(item.name ? { name: item.name } : {}) };
    }),
    version: layer.version,
  };
}
