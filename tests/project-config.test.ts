import { describe, expect, it } from "vitest";

import { replaceProjectSkillConfig } from "../src/server/project-config.js";

describe("project skill config editing", () => {
  it("replaces only skills.config tables and preserves other TOML and comments", () => {
    const source = [
      "# Keep this comment",
      'model = "gpt-5"',
      "",
      "[[skills.config]]",
      'path = "/skills/old/SKILL.md"',
      "enabled = true",
      "",
      "[mcp_servers.demo]",
      'command = "demo"',
      "",
      "[[skills.config]]",
      'path = "/skills/other/SKILL.md"',
      "enabled = false",
      "",
    ].join("\n");

    expect(replaceProjectSkillConfig(source, [
      { path: "/skills/new/SKILL.md", enabled: false },
    ])).toBe([
      "# Keep this comment",
      'model = "gpt-5"',
      "",
      "[[skills.config]]",
      'path = "/skills/new/SKILL.md"',
      "enabled = false",
      "",
      "[mcp_servers.demo]",
      'command = "demo"',
      "",
      "",
    ].join("\n"));
  });

  it("creates canonical tables in an empty project config", () => {
    expect(replaceProjectSkillConfig("", [
      { path: "/skills/a/SKILL.md", enabled: true },
    ])).toBe([
      "[[skills.config]]",
      'path = "/skills/a/SKILL.md"',
      "enabled = true",
      "",
    ].join("\n"));
  });
});
