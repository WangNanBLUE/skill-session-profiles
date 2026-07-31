import { z } from "zod";

export const skillConfigEntrySchema = z.union([
  z.object({
    path: z.string(),
    enabled: z.boolean(),
    name: z.string().optional(),
  }),
  z.object({
    name: z.string(),
    enabled: z.boolean(),
  }),
]);

export type SkillConfigEntry = {
  enabled: boolean;
} & (
  | { path: string; name?: string }
  | { path?: undefined; name: string }
);

export const skillOverrideSchema = z.object({
  path: z.string(),
  state: z.enum(["enabled", "disabled"]),
});

export const resourceToggleEntrySchema = z.object({
  id: z.string().min(1),
  enabled: z.boolean(),
});

export const resourceOverrideSchema = z.object({
  id: z.string().min(1),
  state: z.enum(["enabled", "disabled"]),
});

export const skillProfileSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(80),
  overrides: z.array(skillOverrideSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const profilesFileSchema = z.object({
  schemaVersion: z.literal(1),
  profiles: z.array(skillProfileSchema),
});

export type SkillOverride = z.infer<typeof skillOverrideSchema>;
export type ResourceToggleEntry = z.infer<typeof resourceToggleEntrySchema>;
export type ResourceOverride = z.infer<typeof resourceOverrideSchema>;
export type SkillProfile = z.infer<typeof skillProfileSchema>;
export type ProfilesFile = z.infer<typeof profilesFileSchema>;

export interface SkillMetadata {
  name: string;
  description: string;
  path: string;
  scope: "user" | "repo" | "system" | "admin";
  enabled: boolean;
}

export interface CodexProject {
  id: string;
  name: string;
  rootPaths: string[];
}

export interface PluginMetadata {
  id: string;
  name: string;
  displayName: string;
  description: string;
  marketplace: string;
  installed: boolean;
  enabled: boolean;
}

export interface McpServerMetadata {
  id: string;
  name: string;
  transport: "stdio" | "http" | "unknown";
  detail: string;
  enabled: boolean;
  scopes: Array<"global" | "project">;
}

export interface PluginListResponse {
  marketplaces: Array<{
    name: string;
    plugins: Array<{
      id: string;
      name: string;
      installed: boolean;
      enabled: boolean;
      interface?: {
        displayName?: string | null;
        shortDescription?: string | null;
      } | null;
    }>;
  }>;
  errors?: Array<{
    marketplace?: string;
    message?: string;
  }>;
  nextCursor?: string | null;
}

export interface SkillsListResponse {
  data: Array<{
    cwd: string;
    skills: SkillMetadata[];
    errors: Array<{
      path: string;
      message: string;
    }>;
  }>;
}

export interface ConfigReadResponse {
  config: unknown;
  origins: Record<string, unknown>;
  layers: Array<{
    name: {
      type: string;
      file?: string;
      profile?: string | null;
      dotCodexFolder?: string;
    };
    version: string;
    config: unknown;
    disabledReason?: string | null;
  }> | null;
}

export interface ConfigWriteResponse {
  status: "ok" | "okOverridden";
  version: string;
  filePath: string;
  overriddenMetadata: {
    message: string;
    overridingLayer: unknown;
    effectiveValue: unknown;
  } | null;
}
