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
