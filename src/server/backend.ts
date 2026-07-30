import { extractProjectSkillLayer, extractUserSkillLayer } from "./config-layer.js";
import { listCodexProjects } from "./codex-projects.js";
import { type AppServerClient } from "./app-server-client.js";
import { JsonStore } from "./json-store.js";
import { ProfileService } from "./profile-service.js";
import {
  profilesFileSchema,
  skillConfigEntrySchema,
  skillOverrideSchema,
} from "../shared/contracts.js";
import { z } from "zod";

const callSchema = z.discriminatedUnion("name", [
  z.object({
    name: z.literal("get_skill_profile_state"),
    args: z.object({ cwd: z.string().refine((value) => value.startsWith("/")) }),
  }),
  z.object({
    name: z.literal("save_global_skill_defaults"),
    args: z.object({
      cwd: z.string().refine((value) => value.startsWith("/")),
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
      cwd: z.string().refine((value) => value.startsWith("/")),
      overrides: z.array(skillOverrideSchema),
    }),
  }),
  z.object({
    name: z.literal("save_project_skill_configuration"),
    args: z.object({
      cwd: z.string().refine((value) => value.startsWith("/")),
      overrides: z.array(skillOverrideSchema),
    }),
  }),
  z.object({
    name: z.literal("arm_next_session_profile"),
    args: z.object({
      cwd: z.string().refine((value) => value.startsWith("/")),
      profileId: z.string().nullable(),
      profileName: z.string(),
      overrides: z.array(skillOverrideSchema),
    }),
  }),
  z.object({ name: z.literal("cancel_pending_profile"), args: z.object({}) }),
  z.object({ name: z.literal("recover_global_defaults"), args: z.object({}) }),
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

  constructor(
    readonly client: AppServerClient,
    readonly store: JsonStore,
  ) {
    this.service = new ProfileService(client, store);
  }

  async state(cwd: string) {
    await this.service.reconcile();
    const [inventory, config, profiles, pending, writable, projects] = await Promise.all([
      this.client.listSkills([cwd]),
      this.client.readConfig(cwd),
      this.store.readProfiles(),
      this.store.readPending(),
      this.client.canBatchWrite(),
      listCodexProjects(),
    ]);
    return {
      skills: inventory.data[0]?.skills ?? [],
      globalDefaults: extractUserSkillLayer(config).value,
      projectConfig: extractProjectSkillLayer(config, cwd),
      projects,
      profiles: profiles.profiles,
      pending: pending ?? null,
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
        return { value: await this.service.applyPersistent(input.args.cwd, input.args.overrides) };
      case "save_project_skill_configuration":
        return { value: await this.service.saveProjectConfiguration(input.args.cwd, input.args.overrides) };
      case "arm_next_session_profile":
        return {
          pending: await this.service.arm(
            input.args.cwd,
            input.args.profileId,
            input.args.profileName,
            input.args.overrides,
          ),
        };
      case "cancel_pending_profile":
      case "recover_global_defaults":
        return this.service.restore();
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
