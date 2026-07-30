import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it, vi } from "vitest";

import { SkillProfileBackend } from "../src/server/backend.js";
import { JsonStore } from "../src/server/json-store.js";
import type { AppServerClient } from "../src/server/app-server-client.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })));
});

it("rejects renderer calls outside the explicit backend allowlist", async () => {
  const backend = new SkillProfileBackend(
    {} as AppServerClient,
    new JsonStore("/unused"),
  );

  await expect(backend.call("run_arbitrary_command", {})).rejects.toThrow();
});

it("keeps project-only MCP servers out of global configuration", async () => {
  const globalConfig = {
    config: {
      skills: { config: [] },
      mcp_servers: {
        "global-docs": { url: "https://example.com/mcp", enabled: true },
      },
    },
    origins: {},
    layers: [{
      name: { type: "user", profile: null },
      version: "user-v1",
      config: {
        skills: { config: [] },
        mcp_servers: {
          "global-docs": { url: "https://example.com/mcp", enabled: true },
        },
      },
    }],
  };
  const projectConfig = {
    config: {
      skills: { config: [] },
      mcp_servers: {
        "global-docs": { url: "https://example.com/mcp", enabled: true },
        "project-tools": { command: "node", enabled: false },
      },
    },
    origins: {},
    layers: [
      ...globalConfig.layers,
      {
        name: { type: "project", dotCodexFolder: "/repo/.codex" },
        version: "project-v1",
        config: {
          mcp_servers: {
            "project-tools": { command: "node", enabled: false },
          },
        },
      },
    ],
  };
  const client = {
    listSkills: vi.fn().mockResolvedValue({
      data: [{ cwd: "/repo", skills: [], errors: [] }],
    }),
    readConfig: vi.fn(async (cwd?: string) =>
      cwd === undefined ? globalConfig : projectConfig),
    canBatchWrite: vi.fn().mockResolvedValue(true),
    listPlugins: vi.fn().mockResolvedValue({ marketplaces: [] }),
    batchWriteResourceConfig: vi.fn(),
  } as unknown as AppServerClient;
  const root = await mkdtemp(join(tmpdir(), "backend-resources-"));
  roots.push(root);
  const backend = new SkillProfileBackend(client, new JsonStore(root));

  const state = await backend.state("/repo");
  expect(state.mcpServers).toEqual([
    {
      id: "global-docs",
      name: "global-docs",
      transport: "http",
      detail: "https://example.com/mcp",
      enabled: true,
      scopes: ["global"],
    },
    {
      id: "project-tools",
      name: "project-tools",
      transport: "stdio",
      detail: "node",
      enabled: true,
      scopes: ["project"],
    },
  ]);
  expect(state.globalMcpConfig).toEqual([
    { id: "global-docs", enabled: true },
  ]);
  expect(state.projectMcpConfig.value).toEqual([
    { id: "project-tools", enabled: false },
  ]);

  await expect(backend.call("save_global_resource_configuration", {
    cwd: "/repo",
    resource: "mcp",
    value: [{ id: "project-tools", enabled: true }],
  })).rejects.toThrow("unknown resource id");
  expect(client.batchWriteResourceConfig).not.toHaveBeenCalled();
});

it("matches Codex installed plugin inventory instead of configured remnants", async () => {
  const globalConfig = {
    config: {
      skills: { config: [] },
      plugins: {
        "installed@market": { enabled: false },
        "stale@market": { enabled: true },
        "browser@openai-bundled": { enabled: true },
      },
    },
    origins: {},
    layers: [{
      name: { type: "user", profile: null },
      version: "user-v1",
      config: {
        skills: { config: [] },
        plugins: {
          "installed@market": { enabled: false },
          "stale@market": { enabled: true },
          "browser@openai-bundled": { enabled: true },
        },
      },
    }],
  };
  const client = {
    listSkills: vi.fn().mockResolvedValue({
      data: [{ cwd: "/repo", skills: [], errors: [] }],
    }),
    readConfig: vi.fn().mockResolvedValue(globalConfig),
    canBatchWrite: vi.fn().mockResolvedValue(true),
    listPlugins: vi.fn().mockResolvedValue({
      marketplaces: [{
        name: "market",
        plugins: [
          {
            id: "installed@market",
            name: "installed",
            installed: true,
            enabled: true,
            interface: { displayName: "Installed", shortDescription: "Ready" },
          },
          {
            id: "available@market",
            name: "available",
            installed: false,
            enabled: true,
          },
          {
            id: "browser@openai-bundled",
            name: "browser",
            installed: true,
            enabled: true,
          },
        ],
      }],
    }),
  } as unknown as AppServerClient;
  const root = await mkdtemp(join(tmpdir(), "backend-plugin-inventory-"));
  roots.push(root);

  const state = await new SkillProfileBackend(client, new JsonStore(root)).state("/repo");

  expect(state.plugins).toEqual([{
    id: "installed@market",
    name: "installed",
    displayName: "Installed",
    description: "Ready",
    marketplace: "market",
    installed: true,
    enabled: false,
  }]);
});

it("uses configured plugins only when Codex plugin inventory is unavailable", async () => {
  const config = {
    config: {
      skills: { config: [] },
      plugins: {
        "fallback@market": { enabled: false },
      },
    },
    origins: {},
    layers: [{
      name: { type: "user", profile: null },
      version: "user-v1",
      config: {
        skills: { config: [] },
        plugins: {
          "fallback@market": { enabled: false },
        },
      },
    }],
  };
  const client = {
    listSkills: vi.fn().mockResolvedValue({
      data: [{ cwd: "/repo", skills: [], errors: [] }],
    }),
    readConfig: vi.fn().mockResolvedValue(config),
    canBatchWrite: vi.fn().mockResolvedValue(true),
    listPlugins: vi.fn().mockRejectedValue(new Error("plugin/list unavailable")),
  } as unknown as AppServerClient;
  const root = await mkdtemp(join(tmpdir(), "backend-plugin-fallback-"));
  roots.push(root);

  const state = await new SkillProfileBackend(client, new JsonStore(root)).state("/repo");

  expect(state.plugins.map((plugin) => plugin.id)).toEqual(["fallback@market"]);
  expect(state.plugins[0]?.enabled).toBe(false);
});

it("matches Codex standalone skill inventory", async () => {
  const skill = (
    name: string,
    path: string,
    scope: "user" | "repo" | "system" | "admin" = "user",
  ) => ({ name, path, scope, description: "", enabled: true });
  const config = {
    config: { skills: { config: [] } },
    origins: {},
    layers: [{
      name: { type: "user", profile: null },
      version: "user-v1",
      config: { skills: { config: [] } },
    }],
  };
  const client = {
    listSkills: vi.fn().mockResolvedValue({
      data: [{
        cwd: "/repo",
        errors: [],
        skills: [
          skill("Taste", "/Users/test/.codex/skills/taste/SKILL.md"),
          skill("Project", "/repo/.codex/skills/project/SKILL.md", "repo"),
          skill("Project", "/Users/test/.codex/skills/project/SKILL.md"),
          skill("System", "/Users/test/.codex/skills/.system/system/SKILL.md", "system"),
          skill(
            "Plugin",
            "/Users/test/.codex/plugins/cache/market/plugin/1/skills/tool/SKILL.md",
          ),
          skill("Imported", "/Users/test/.agents/skills/imported/SKILL.md"),
          skill("Admin", "/opt/codex/skills/admin/SKILL.md", "admin"),
        ],
      }],
    }),
    readConfig: vi.fn().mockResolvedValue(config),
    canBatchWrite: vi.fn().mockResolvedValue(true),
    listPlugins: vi.fn().mockResolvedValue({ marketplaces: [] }),
  } as unknown as AppServerClient;
  const root = await mkdtemp(join(tmpdir(), "backend-skill-inventory-"));
  roots.push(root);

  const state = await new SkillProfileBackend(client, new JsonStore(root)).state("/repo");

  expect(state.skills.map((entry) => [entry.name, entry.path])).toEqual([
    ["Project", "/repo/.codex/skills/project/SKILL.md"],
    ["Taste", "/Users/test/.codex/skills/taste/SKILL.md"],
  ]);
});
