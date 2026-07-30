import { readFile } from "node:fs/promises";
import { isAbsolute, join, normalize } from "node:path";

import { resolveCodexHome } from "./data-root.js";
import type { CodexProject } from "../shared/contracts.js";

export async function listCodexProjects(): Promise<CodexProject[]> {
  let raw: string;
  try {
    raw = await readFile(join(resolveCodexHome(), ".codex-global-state.json"), "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
  const state = JSON.parse(raw) as Record<string, unknown>;
  const projects = state["local-projects"] as Record<string, unknown> | undefined;
  if (!projects || typeof projects !== "object") return [];
  const order = Array.isArray(state["project-order"])
    ? state["project-order"].filter((id): id is string => typeof id === "string")
    : [];
  const ids = [...order, ...Object.keys(projects).filter((id) => !order.includes(id))];
  return ids.flatMap((id) => {
    const value = projects[id] as { name?: unknown; rootPaths?: unknown } | undefined;
    if (typeof value?.name !== "string" || !Array.isArray(value.rootPaths)) return [];
    const rootPaths = value.rootPaths
      .filter((path): path is string => typeof path === "string" && isAbsolute(path))
      .map(normalize);
    return rootPaths.length === 0 ? [] : [{ id, name: value.name, rootPaths }];
  });
}
