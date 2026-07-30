import React from "react";
import { createRoot } from "react-dom/client";
import { App } from "../../src/ui/App.js";
import type { SkillProfile } from "../../src/shared/contracts.js";
import "../../src/ui/styles.css";

const skills = Array.from({ length: 10 }, (_, index) => ({
  name: ["Code Review", "Playwright", "OpenAI Docs", "PDF", "Skill Creator"][index % 5],
  description: "用于 Codex 工作流的可复用能力",
  path: `/Users/demo/.codex/skills/example-${index}/SKILL.md`,
  scope: index % 3 === 0 ? "system" as const : "user" as const,
  enabled: index % 4 !== 0,
}));
const profiles: SkillProfile[] = [
  { id: "daily", name: "日常开发", overrides: [{ path: skills[0].path, state: "enabled" }], createdAt: "2026-07-28T00:00:00.000Z", updatedAt: "2026-07-28T00:00:00.000Z" },
  { id: "review", name: "代码审查", overrides: [{ path: skills[1].path, state: "disabled" }], createdAt: "2026-07-28T00:00:00.000Z", updatedAt: "2026-07-28T00:00:00.000Z" },
];
let state = {
  plugins: [
    {
      id: "browser@openai-bundled",
      name: "browser",
      displayName: "Browser",
      description: "控制应用内浏览器",
      marketplace: "openai-bundled",
      installed: true,
      enabled: true,
    },
    {
      id: "github@openai-curated-remote",
      name: "github",
      displayName: "GitHub",
      description: "管理仓库、议题和拉取请求",
      marketplace: "openai-curated-remote",
      installed: true,
      enabled: false,
    },
  ],
  mcpServers: [
    {
      id: "openaiDeveloperDocs",
      name: "openaiDeveloperDocs",
      transport: "http" as const,
      detail: "https://developers.openai.com/mcp",
      enabled: true,
      scopes: ["global"] as const,
    },
    {
      id: "local-tools",
      name: "local-tools",
      transport: "stdio" as const,
      detail: "node",
      enabled: true,
      scopes: ["global", "project"] as const,
    },
  ],
  globalPluginConfig: [
    { id: "browser@openai-bundled", enabled: true },
    { id: "github@openai-curated-remote", enabled: false },
  ],
  projectPluginConfig: {
    value: [{ id: "github@openai-curated-remote", enabled: true }],
    filePath: "/Users/demo/projects/demo-project/.codex/config.toml",
  },
  globalMcpConfig: [
    { id: "openaiDeveloperDocs", enabled: true },
    { id: "local-tools", enabled: true },
  ],
  projectMcpConfig: {
    value: [{ id: "local-tools", enabled: false }],
    filePath: "/Users/demo/projects/demo-project/.codex/config.toml",
  },
  skills,
  globalDefaults: skills.map(({ path, enabled }) => ({ path, enabled })),
  projectConfig: { value: [], filePath: "/Users/demo/projects/demo-project/.codex/config.toml" },
  projects: [
    { id: "demo", name: "demo-project", rootPaths: ["/Users/demo/projects/demo-project", "/Users/demo/projects/demo-site"] },
    { id: "radio", name: "Mineradio", rootPaths: ["/Users/demo/projects/Mineradio"] },
  ],
  profiles,
  pending: null,
  writable: true,
};
const api = {
  async call(name: string, args: Record<string, unknown>) {
    if (name === "get_skill_profile_state") return state;
    if (name === "save_global_resource_configuration") {
      if (args.resource === "plugin") {
        state = {
          ...state,
          globalPluginConfig: args.value as typeof state.globalPluginConfig,
        };
      } else {
        state = {
          ...state,
          globalMcpConfig: args.value as typeof state.globalMcpConfig,
        };
      }
      return { value: args.value };
    }
    if (name === "save_project_resource_configuration") {
      if (args.resource === "plugin") {
        state = {
          ...state,
          projectPluginConfig: {
            ...state.projectPluginConfig,
            value: args.value as typeof state.projectPluginConfig.value,
          },
        };
      } else {
        state = {
          ...state,
          projectMcpConfig: {
            ...state.projectMcpConfig,
            value: args.value as typeof state.projectMcpConfig.value,
          },
        };
      }
      return { value: args.value };
    }
    if (name === "save_skill_profile") {
      const profile = {
        id: String(args.id ?? Date.now()),
        name: String(args.name),
        overrides: args.overrides as SkillProfile["overrides"],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      state = {
        ...state,
        profiles: [...state.profiles.filter((item) => item.id !== profile.id), profile],
      };
      return { profile };
    }
    return state;
  },
};

createRoot(document.getElementById("root")!).render(<App api={api} cwd="/Users/demo/projects/demo-project" />);
