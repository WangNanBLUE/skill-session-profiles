import { constants } from "node:fs";
import { copyFile, mkdir, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const DATA_FILES = ["profiles.json", "pending.json", "audit.jsonl", "audit.1.jsonl"];

export function resolveCodexHome(): string {
  return process.env.CODEX_HOME?.trim() || resolve(homedir(), ".codex");
}

export function resolveSharedDataRoot(): string {
  return process.env.SKILL_SESSION_PROFILES_DATA?.trim()
    || resolve(resolveCodexHome(), "skill-session-profiles");
}

export async function prepareSharedDataRoot(
  additionalLegacyRoots: string[] = [],
): Promise<string> {
  const targetRoot = resolveSharedDataRoot();
  await mkdir(targetRoot, { recursive: true, mode: 0o700 });

  const legacyRoots = [
    ...additionalLegacyRoots,
    ...await findCachedPluginDataRoots(resolveCodexHome()),
  ].filter((root, index, roots) => root !== targetRoot && roots.indexOf(root) === index);

  for (const sourceRoot of legacyRoots) {
    for (const name of DATA_FILES) {
      try {
        await copyFile(join(sourceRoot, name), join(targetRoot, name), constants.COPYFILE_EXCL);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "EEXIST" && code !== "ENOENT") throw error;
      }
    }
  }
  return targetRoot;
}

async function findCachedPluginDataRoots(codexHome: string): Promise<string[]> {
  const cacheRoot = join(codexHome, "plugins", "cache");
  const roots: Array<{ path: string; version: string }> = [];
  for (const marketplace of await directories(cacheRoot)) {
    const pluginRoot = join(cacheRoot, marketplace, "skill-session-profiles");
    for (const version of await directories(pluginRoot)) {
      roots.push({
        path: join(pluginRoot, version, ".plugin-data"),
        version,
      });
    }
  }
  return roots
    .sort((a, b) => b.version.localeCompare(a.version))
    .map((item) => item.path);
}

async function directories(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}
