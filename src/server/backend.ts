import {
  extractProjectResourceLayer,
  extractUserResourceLayer,
  extractUserSkillLayer,
} from "./config-layer.js";
import { listCodexProjects } from "./codex-projects.js";
import { resolveCodexHome } from "./data-root.js";
import { type AppServerClient } from "./app-server-client.js";
import { JsonStore } from "./json-store.js";
import { ProfileService } from "./profile-service.js";
import { readProjectSkillPolicy } from "./project-agents.js";
import {
  ResourceControlService,
  type ResourceKind,
} from "./resource-control-service.js";
import {
  profilesFileSchema,
  resourceToggleEntrySchema,
  skillConfigEntrySchema,
  skillOverrideSchema,
  type ConfigReadResponse,
  type McpServerMetadata,
  type PluginListResponse,
  type PluginMetadata,
  type ResourceToggleEntry,
  type SkillConfigEntry,
  type SkillMetadata,
} from "../shared/contracts.js";
import { readFile } from "node:fs/promises";
import { dirname, isAbsolute, join, normalize, win32 } from "node:path";
import { z } from "zod";

const CODEX_HIDDEN_PLUGIN_IDS = new Set([
  "browser@openai-bundled",
  "openai-library@openai-curated-remote",
]);

const curatedSkillCacheSchema = z.object({
  skills: z.array(z.object({ id: z.string().min(1) })),
});

const absolutePathSchema = z.string().refine(
  (value) => isAbsolute(value) || win32.isAbsolute(value),
);

const callSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("get_skill_profile_state"),
    args: z.object({ cwd: absolutePathSchema }),
  }),
  z.object({
    name: z.literal("save_global_skill_defaults"),
    args: z.object({
      cwd: absolutePathSchema,
      value: z.array(skillConfigEntrySchema),
    }),
  }),
  z.object({
    name: z.literal("save_skill_profile"),
    args: z.object({
      id: z.string().optional(),
      name: z.string(),
      overrides: z.array(skillOverrideSchema),
    }),
  }),
  z.object({
    name: z.literal("delete_skill_profile"),
    args: z.object({ id: z.string() }),
  }),
  z.object({
    name: z.literal("apply_skill_configuration"),
    args: z.object({
      cwd: absolutePathSchema,
      profileId: z.string().nullable(),
      overrides: z.array(skillOverrideSchema),
    }),
  }),
  z.object({
    name: z.literal("save_project_skill_configuration"),
    args: z.object({
      cwd: absolutePathSchema,
      overrides: z.array(skillOverrideSchema),
    }),
  }),
  z.object({
    name: z.literal("save_global_resource_configuration"),
    args: z.object({
      cwd: absolutePathSchema,
      resource: z.enum(["plugin", "mcp"]),
      value: z.array(resourceToggleEntrySchema),
    }),
  }),
  z.object({
    name: z.literal("save_project_resource_configuration"),
    args: z.object({
      cwd: absolutePathSchema,
      resource: z.enum(["plugin", "mcp"]),
      value: z.array(resourceToggleEntrySchema),
    }),
  }),
  z.object({ name: z.literal("export_skill_profiles"), args: z.object({}) }),
  z.object({
    name: z.literal("import_skill_profiles"),
    args: z.object({
      data: z.string(),
      mode: z.enum(["merge", "replace"]),
      confirmed: z.literal(true),
    }),
  }),
]);

export type BackendCallName = z.infer<typeof callSchema>["name"];

export class SkillProfileBackend {
  readonly service: ProfileService;
  readonly resourceService: ResourceControlService;

  constructor(
    readonly client: AppServerClient,
    readonly store: JsonStore,
  ) {
    this.service = new ProfileService(client, store);
    this.resourceService = new ResourceControlService(client, store);
  }

  async state(cwd: string) {
    const [
      inventory,
      config,
      globalConfig,
      profiles,
      writable,
      projects,
      pluginList,
      curatedSkillPaths,
      projectSkillPolicy,
    ] = await Promise.all([
      this.client.listSkills([cwd]),
      this.client.readConfig(cwd),
      this.client.readConfig(),
      this.store.readProfiles(),
      this.client.canBatchWrite(),
      listCodexProjects(),
      this.client.listPlugins().catch((): null => null),
      readCodexCuratedSkillPaths(),
      readProjectSkillPolicy(this.client, cwd),
    ]);
    const plugins = pluginInventory(pluginList, globalConfig, config);
    const mcpServers = mcpInventory(globalConfig, config);
    const globalPluginConfig = resourceValues(
      plugins,
      extractUserResourceLayer(globalConfig, "plugins").value,
    );
    const globalMcpConfig = resourceValues(
      mcpServers.filter((server) => server.scopes.includes("global")),
      extractUserResourceLayer(globalConfig, "mcp_servers").value,
    );
    const skills = configurableSkillInventory(
      inventory.data[0]?.skills ?? [],
      curatedSkillPaths,
    );
    const inventoryPaths = new Map(skills.flatMap((skill) => [
      [normalize(skill.path), skill.path] as const,
      [normalize(dirname(skill.path)), skill.path] as const,
    ]));
    const toInventoryPaths = (value: SkillConfigEntry[]) => value
      .filter((entry): entry is SkillConfigEntry & { path: string } => entry.path !== undefined)
      .map((entry) => ({ ...entry, path: inventoryPaths.get(normalize(entry.path)) ?? entry.path }));
    return {
      skills,
      globalDefaults: toInventoryPaths(extractUserSkillLayer(config).value),
      projectConfig: {
        filePath: projectSkillPolicy.filePath,
        value: toInventoryPaths(projectSkillPolicy.value),
      },
      plugins,
      mcpServers,
      globalPluginConfig,
      projectPluginConfig: extractProjectResourceLayer(config, cwd, "plugins"),
      globalMcpConfig,
      projectMcpConfig: extractProjectResourceLayer(config, cwd, "mcp_servers"),
      projects,
      profiles: profiles.profiles,
      activeProfileId: profiles.activeProfileId ?? null,
      writable,
    };
  }

  async call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>> {
    const input = callSchema.parse({ name, args });
    switch (input.name) {
      case "get_skill_profile_state":
        return this.state(input.args.cwd);
      case "save_global_skill_defaults":
        await this.service.saveGlobalDefaults(input.args.cwd, input.args.value);
        return this.state(input.args.cwd);
      case "save_skill_profile":
        return { profile: await this.service.saveProfile(input.args) };
      case "delete_skill_profile":
        await this.service.deleteProfile(input.args.id);
        return { deleted: input.args.id };
      case "apply_skill_configuration":
        return {
          value: await this.service.applyPersistent(
            input.args.cwd,
            input.args.overrides,
            input.args.profileId,
          ),
        };
      case "save_project_skill_configuration":
        return { value: await this.service.saveProjectConfiguration(input.args.cwd, input.args.overrides) };
      case "save_global_resource_configuration": {
        const current = await this.state(input.args.cwd);
        return {
          value: await this.resourceService.saveGlobal(
            input.args.cwd,
            input.args.resource,
            input.args.value,
            resourceIds(current, input.args.resource, "global"),
          ),
        };
      }
      case "save_project_resource_configuration": {
        const current = await this.state(input.args.cwd);
        return {
          value: await this.resourceService.saveProject(
            input.args.cwd,
            input.args.resource,
            input.args.value,
            resourceIds(current, input.args.resource, "project"),
          ),
        };
      }
      case "export_skill_profiles":
        return this.store.readProfiles();
      case "import_skill_profiles": {
        const incoming = profilesFileSchema.parse(JSON.parse(input.args.data));
        await this.store.withLock(async () => {
          const current = await this.store.readProfiles();
          await this.store.writeProfiles({
            schemaVersion: 1,
            profiles: input.args.mode === "replace"
              ? incoming.profiles
              : [
                  ...current.profiles.filter(
                    (a) => !incoming.profiles.some((b) => a.id === b.id),
                  ),
                  ...incoming.profiles,
                ],
          });
        });
        return this.store.readProfiles();
      }
    }
  }
}

function resourceIds(
  state: Awaited<ReturnType<SkillProfileBackend["state"]>>,
  resource: ResourceKind,
  scope: "global" | "project",
): Set<string> {
  return new Set(
    (resource === "plugin"
      ? state.plugins
      : state.mcpServers.filter((server) =>
          scope === "project" || server.scopes.includes("global")))
      .map((item) => item.id),
  );
}

function resourceValues(
  inventory: Array<{ id: string; enabled: boolean }>,
  explicit: ResourceToggleEntry[],
): ResourceToggleEntry[] {
  const overrides = new Map(explicit.map((entry) => [entry.id, entry.enabled]));
  return inventory.map((item) => ({
    id: item.id,
    enabled: overrides.get(item.id) ?? item.enabled,
  }));
}

function pluginInventory(
  response: PluginListResponse | null,
  globalConfig: ConfigReadResponse,
  projectConfig: ConfigReadResponse,
): PluginMetadata[] {
  const result = new Map<string, PluginMetadata>();
  if (response !== null) {
    for (const marketplace of response.marketplaces) {
      for (const plugin of marketplace.plugins) {
        if (!plugin.installed || CODEX_HIDDEN_PLUGIN_IDS.has(plugin.id)) continue;
        result.set(plugin.id, {
          id: plugin.id,
          name: plugin.name,
          displayName: plugin.interface?.displayName ?? plugin.name,
          description: plugin.interface?.shortDescription ?? "",
          marketplace: marketplace.name,
          installed: true,
          enabled: configuredEnabled(globalConfig.config, "plugins", plugin.id, plugin.enabled),
        });
      }
    }
  } else {
    for (const id of resourceIdsFromConfigs("plugins", globalConfig, projectConfig)) {
      if (CODEX_HIDDEN_PLUGIN_IDS.has(id)) continue;
      const [name, marketplace = "configured"] = id.split("@", 2);
      result.set(id, {
        id,
        name,
        displayName: name,
        description: "",
        marketplace,
        installed: true,
        enabled: configuredEnabled(globalConfig.config, "plugins", id, true),
      });
    }
  }

  return [...result.values()].sort((a, b) =>
    a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" }));
}

function configurableSkillInventory(
  skills: SkillMetadata[],
  curatedSkillPaths: Set<string>,
): SkillMetadata[] {
  const result = new Map<string, SkillMetadata>();
  for (const skill of skills) {
    if (!isConfigurableSkill(skill, curatedSkillPaths)) continue;
    const current = result.get(skill.name);
    if (
      current === undefined
      || skillScopePriority(skill.scope) < skillScopePriority(current.scope)
      || (
        skill.scope === current.scope
        && skill.path.localeCompare(current.path) < 0
      )
    ) {
      result.set(skill.name, skill);
    }
  }
  return [...result.values()].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function isConfigurableSkill(
  skill: SkillMetadata,
  curatedSkillPaths: Set<string>,
): boolean {
  if (skill.scope === "system") return false;
  return !curatedSkillPaths.has(normalize(skill.path));
}

async function readCodexCuratedSkillPaths(): Promise<Set<string>> {
  try {
    const codexHome = resolveCodexHome();
    const cache = curatedSkillCacheSchema.parse(JSON.parse(await readFile(
      join(codexHome, "vendor_imports", "skills-curated-cache.json"),
      "utf8",
    )));
    return new Set(cache.skills.map(({ id }) =>
      normalize(join(codexHome, "skills", id, "SKILL.md"))));
  } catch {
    return new Set();
  }
}

function skillScopePriority(scope: SkillMetadata["scope"]): number {
  return {
    repo: 0,
    user: 1,
    system: 2,
    admin: 3,
  }[scope];
}

function mcpInventory(
  globalConfig: ConfigReadResponse,
  projectConfig: ConfigReadResponse,
): McpServerMetadata[] {
  const globalIds = resourceIdsFromGlobalConfig("mcp_servers", globalConfig);
  const projectIds = resourceIdsFromLayers(
    "mcp_servers",
    projectConfig,
    "project",
  );
  const ids = new Set([...globalIds, ...projectIds]);
  return [...ids].map((id) => {
    const raw = resourceTable(projectConfig.config, "mcp_servers")[id]
      ?? resourceTable(globalConfig.config, "mcp_servers")[id];
    const value = typeof raw === "object" && raw !== null
      ? raw as Record<string, unknown>
      : {};
    const transport = typeof value.url === "string"
      ? "http" as const
      : typeof value.command === "string" ? "stdio" as const : "unknown" as const;
    return {
      id,
      name: id,
      transport,
      detail: transport === "http"
        ? String(value.url)
        : transport === "stdio" ? String(value.command) : "",
      enabled: configuredEnabled(globalConfig.config, "mcp_servers", id, true),
      scopes: [
        ...(globalIds.has(id) ? ["global" as const] : []),
        ...(projectIds.has(id) ? ["project" as const] : []),
      ],
    };
  }).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function resourceIdsFromLayers(
  namespace: "plugins" | "mcp_servers",
  response: ConfigReadResponse,
  layerType: string,
): Set<string> {
  const ids = new Set<string>();
  for (const layer of response.layers ?? []) {
    if (layer.name.type !== layerType || layer.disabledReason != null) continue;
    for (const id of Object.keys(resourceTable(layer.config, namespace))) ids.add(id);
  }
  return ids;
}

function resourceIdsFromGlobalConfig(
  namespace: "plugins" | "mcp_servers",
  response: ConfigReadResponse,
): Set<string> {
  if (response.layers === null) {
    return new Set(Object.keys(resourceTable(response.config, namespace)));
  }
  const ids = new Set<string>();
  for (const layer of response.layers) {
    if (layer.name.type === "project" || layer.disabledReason != null) continue;
    for (const id of Object.keys(resourceTable(layer.config, namespace))) ids.add(id);
  }
  return ids;
}

function resourceIdsFromConfigs(
  namespace: "plugins" | "mcp_servers",
  ...responses: ConfigReadResponse[]
): Set<string> {
  const ids = new Set<string>();
  for (const response of responses) {
    for (const id of Object.keys(resourceTable(response.config, namespace))) ids.add(id);
    for (const layer of response.layers ?? []) {
      for (const id of Object.keys(resourceTable(layer.config, namespace))) ids.add(id);
    }
  }
  return ids;
}

function resourceTable(
  config: unknown,
  namespace: "plugins" | "mcp_servers",
): Record<string, unknown> {
  if (typeof config !== "object" || config === null || Array.isArray(config)) return {};
  const value = (config as Record<string, unknown>)[namespace];
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function configuredEnabled(
  config: unknown,
  namespace: "plugins" | "mcp_servers",
  id: string,
  fallback: boolean,
): boolean {
  const value = resourceTable(config, namespace)[id];
  if (typeof value !== "object" || value === null || Array.isArray(value)) return fallback;
  const enabled = (value as { enabled?: unknown }).enabled;
  return typeof enabled === "boolean" ? enabled : fallback;
}
