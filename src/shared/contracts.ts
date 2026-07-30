import { z } from "zod";

export interface SkillConfigEntry {
  path: string;
  enabled: boolean;
  name?: string;
}

export const skillConfigEntrySchema = z.object({
  path: z.string(),
  enabled: z.boolean(),
  name: z.string().optional(),
});

export const skillOverrideSchema = z.object({
  path: z.string(),
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

export const pendingFileSchema = z.object({
  schemaVersion: z.literal(1),
  state: z.enum(["prepared", "armed", "conflict"]),
  profileId: z.string().nullable(),
  profileName: z.string().min(1),
  cwd: z.string(),
  baseline: z.array(skillConfigEntrySchema),
  target: z.array(skillConfigEntrySchema),
  baselineHash: z.string(),
  targetHash: z.string(),
  expectedVersion: z.string(),
  armedAt: z.string(),
  consumerSessionId: z.string().optional(),
});

export type SkillOverride = z.infer<typeof skillOverrideSchema>;
export type SkillProfile = z.infer<typeof skillProfileSchema>;
export type ProfilesFile = z.infer<typeof profilesFileSchema>;
export type PendingFile = z.infer<typeof pendingFileSchema>;

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
