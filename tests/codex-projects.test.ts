import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, expect, it, vi } from "vitest";

import { listCodexProjects } from "../src/server/codex-projects.js";

const roots: string[] = [];

afterEach(async () => {
  vi.unstubAllEnvs();
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("reads local projects in the same order as Codex", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-projects-"));
  roots.push(root);
  vi.stubEnv("CODEX_HOME", root);
  await writeFile(join(root, ".codex-global-state.json"), JSON.stringify({
    "project-order": ["p2", "p1"],
    "local-projects": {
      p1: { name: "One", rootPaths: ["/projects/one"] },
      p2: { name: "Two", rootPaths: ["/projects/two", "/projects/two-site"] },
    },
  }));

  await expect(listCodexProjects()).resolves.toEqual([
    { id: "p2", name: "Two", rootPaths: ["/projects/two", "/projects/two-site"] },
    { id: "p1", name: "One", rootPaths: ["/projects/one"] },
  ]);
});
