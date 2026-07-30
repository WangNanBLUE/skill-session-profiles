import { join, normalize } from "node:path";

import type {
  ConfigReadResponse,
  ResourceToggleEntry,
  SkillConfigEntry,
} from "../shared/contracts.js";

export interface UserSkillLayer {
  value: SkillConfigEntry[];
  version: string;
}

export interface UserResourceLayer {
  value: ResourceToggleEntry[];
  version: string;
}

export interface ProjectResourceLayer {
  value: ResourceToggleEntry[];
  version: string | null;
  filePath: string;
}

function extractSkillConfig(config: unknown): SkillConfigEntry[] {
  const value = (config as { skills?: { config?: unknown } }).skills?.config;
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error("skills.config is not an array");
  return value.map((entry) => {
    const item = entry as { path?: unknown; name?: unknown; enabled?: unknown };
    if (
      typeof item.enabled !== "boolean"
      || (typeof item.path !== "string" && typeof item.name !== "string")
    ) {
      throw new Error("invalid skills.config entry");
    }
    return {
      ...(typeof item.path === "string" ? { path: item.path } : {}),
      ...(typeof item.name === "string" ? { name: item.name } : {}),
      enabled: item.enabled,
    } as SkillConfigEntry;
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
  const layer = closestProjectLayer(response);
  return {
    value: layer ? extractSkillConfig(layer.config) : [],
    version: layer?.version ?? null,
    filePath: projectConfigPath(layer, cwd),
  };
}

export function extractUserResourceLayer(
  response: ConfigReadResponse,
  namespace: "plugins" | "mcp_servers",
): UserResourceLayer {
  const layer = response.layers?.find(
    ({ name }) => name.type === "user" && (name.profile ?? null) === null,
  );
  if (layer === undefined) throw new Error("base user config layer is unavailable");
  return {
    value: extractResourceConfig(layer.config, namespace),
    version: layer.version,
  };
}

export function extractProjectResourceLayer(
  response: ConfigReadResponse,
  cwd: string,
  namespace: "plugins" | "mcp_servers",
): ProjectResourceLayer {
  const layer = closestProjectLayer(response);
  return {
    value: layer ? extractResourceConfig(layer.config, namespace) : [],
    version: layer?.version ?? null,
    filePath: projectConfigPath(layer, cwd),
  };
}

function extractResourceConfig(
  config: unknown,
  namespace: "plugins" | "mcp_servers",
): ResourceToggleEntry[] {
  const table = (config as Record<string, unknown> | null)?.[namespace];
  if (table === undefined) return [];
  if (typeof table !== "object" || table === null || Array.isArray(table)) {
    throw new Error(`${namespace} is not a table`);
  }
  return Object.entries(table).flatMap(([id, raw]) => {
    if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
    const enabled = (raw as { enabled?: unknown }).enabled;
    return typeof enabled === "boolean" ? [{ id, enabled }] : [];
  });
}

function closestProjectLayer(response: ConfigReadResponse) {
  return (response.layers ?? [])
    .filter(({ name, disabledReason }) =>
      name.type === "project"
      && name.dotCodexFolder
      && disabledReason == null)
    .sort((a, b) => b.name.dotCodexFolder!.length - a.name.dotCodexFolder!.length)[0];
}

function projectConfigPath(
  layer: NonNullable<ConfigReadResponse["layers"]>[number] | undefined,
  cwd: string,
): string {
  return join(layer?.name.dotCodexFolder ?? join(normalize(cwd), ".codex"), "config.toml");
}
