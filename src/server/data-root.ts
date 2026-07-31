import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { resolve } from "node:path";

export function resolveCodexHome(): string {
  return process.env.CODEX_HOME?.trim() || resolve(homedir(), ".codex");
}

export function resolveSharedDataRoot(): string {
  return process.env.SKILL_SESSION_PROFILES_DATA?.trim()
    || resolve(resolveCodexHome(), "skill-session-profiles");
}

export async function prepareSharedDataRoot(): Promise<string> {
  const targetRoot = resolveSharedDataRoot();
  await mkdir(targetRoot, { recursive: true, mode: 0o700 });
  return targetRoot;
}
