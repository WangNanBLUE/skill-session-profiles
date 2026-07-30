import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps";
import { z } from "zod";

import { AppServerClient } from "./app-server-client.js";
import { SkillProfileBackend } from "./backend.js";
import { prepareSharedDataRoot } from "./data-root.js";
import { JsonStore } from "./json-store.js";
import { profilesFileSchema, skillConfigEntrySchema, skillOverrideSchema } from "../shared/contracts.js";

const UI_URI = "ui://skill-session-profiles/panel.html";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const client = new AppServerClient();
const store = new JsonStore(await prepareSharedDataRoot([
  process.env.PLUGIN_DATA ?? resolve(root, ".plugin-data"),
]));
const backend = new SkillProfileBackend(client, store);
const server = new McpServer({ name: "skill-session-profiles", version: "0.1.0" });
const result = (value: unknown) => ({
  content: [{ type: "text" as const, text: "Skill profile state updated." }],
  structuredContent: value as Record<string, unknown>,
});

async function state(cwd: string) {
  return backend.state(cwd);
}

server.registerResource("skill-session-profiles-panel", UI_URI, {}, async () => ({
  contents: [{
    uri: UI_URI,
    mimeType: RESOURCE_MIME_TYPE,
    text: await readFile(resolve(root, "dist/ui/panel.html"), "utf8"),
  }],
}));

server.registerTool("open_skill_session_profiles", {
  description: "Open the Skill Session Profiles panel.",
  inputSchema: { cwd: z.string().refine((value) => value.startsWith("/")) },
  _meta: { ui: { resourceUri: UI_URI } },
  annotations: { readOnlyHint: true },
}, async ({ cwd }) => result(await state(cwd)));

server.registerTool("get_skill_profile_state", {
  description: "Read skills, defaults, profiles, and pending state.",
  inputSchema: { cwd: z.string() },
  annotations: { readOnlyHint: true },
}, async ({ cwd }) => result(await state(cwd)));

server.registerTool("save_global_skill_defaults", {
  description: "Replace global skill defaults.",
  inputSchema: { cwd: z.string(), value: z.array(skillConfigEntrySchema) },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ cwd, value }) => {
  await backend.service.saveGlobalDefaults(cwd, value);
  return result(await state(cwd));
});

server.registerTool("save_skill_profile", {
  description: "Create or update a reusable skill profile.",
  inputSchema: { id: z.string().optional(), name: z.string(), overrides: z.array(skillOverrideSchema) },
  annotations: { readOnlyHint: false },
}, async (input) => result({ profile: await backend.service.saveProfile(input) }));

server.registerTool("delete_skill_profile", {
  description: "Delete a profile that is not armed.",
  inputSchema: { id: z.string() },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ id }) => {
  await backend.service.deleteProfile(id);
  return result({ deleted: id });
});

server.registerTool("apply_skill_configuration", {
  description: "Persist a skill configuration for subsequently opened Codex tasks.",
  inputSchema: { cwd: z.string(), overrides: z.array(skillOverrideSchema) },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ cwd, overrides }) =>
  result({ value: await backend.service.applyPersistent(cwd, overrides) }));

server.registerTool("save_project_skill_configuration", {
  description: "Save skill overrides in the selected project's .codex/config.toml.",
  inputSchema: { cwd: z.string(), overrides: z.array(skillOverrideSchema) },
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
}, async ({ cwd, overrides }) =>
  result({ value: await backend.service.saveProjectConfiguration(cwd, overrides) }));

server.registerTool("arm_next_session_profile", {
  description: "Apply a skill overlay to the next qualifying Codex task.",
  inputSchema: {
    cwd: z.string(), profileId: z.string().nullable(), profileName: z.string(),
    overrides: z.array(skillOverrideSchema),
  },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ cwd, profileId, profileName, overrides }) =>
  result({ pending: await backend.service.arm(cwd, profileId, profileName, overrides) }));

for (const name of ["cancel_pending_profile", "recover_global_defaults"] as const) {
  server.registerTool(name, {
    description: "Guardedly restore global skill defaults.",
    annotations: { readOnlyHint: false, destructiveHint: true },
  }, async () => result(await backend.service.restore()));
}

server.registerTool("export_skill_profiles", {
  description: "Export all profiles as versioned JSON.",
  annotations: { readOnlyHint: true },
}, async () => result(await store.readProfiles()));

server.registerTool("import_skill_profiles", {
  description: "Import validated profiles, replacing or merging existing profiles.",
  inputSchema: { data: z.string(), mode: z.enum(["merge", "replace"]), confirmed: z.literal(true) },
  annotations: { readOnlyHint: false, destructiveHint: true },
}, async ({ data, mode }) => {
  const incoming = profilesFileSchema.parse(JSON.parse(data));
  await store.withLock(async () => {
    const current = await store.readProfiles();
    await store.writeProfiles({
      schemaVersion: 1,
      profiles: mode === "replace"
        ? incoming.profiles
        : [...current.profiles.filter((a) => !incoming.profiles.some((b) => a.id === b.id)), ...incoming.profiles],
    });
  });
  return result(await store.readProfiles());
});

await server.connect(new StdioServerTransport());
process.on("SIGTERM", () => void client.close().finally(() => process.exit(0)));
