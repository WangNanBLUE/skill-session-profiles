import { describe, expect, it } from "vitest";

import {
  replaceProjectResourceConfig,
  replaceProjectSkillConfig,
} from "../src/server/project-config.js";

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

  it("renders name-based selectors without inventing a path", () => {
    expect(replaceProjectSkillConfig("", [
      { name: "skill-creator", enabled: false },
    ])).toBe([
      "[[skills.config]]",
      'name = "skill-creator"',
      "enabled = false",
      "",
    ].join("\n"));
  });
});

describe("project resource config editing", () => {
  it("updates plugin enabled state without replacing other fields or comments", () => {
    const source = [
      "# Plugin channel is managed separately",
      '[plugins."browser@openai-bundled"]',
      'channel = "stable"',
      "enabled = true",
      "",
    ].join("\n");

    expect(replaceProjectResourceConfig(source, "plugins", [
      { id: "browser@openai-bundled", enabled: false },
    ])).toBe([
      "# Plugin channel is managed separately",
      '[plugins."browser@openai-bundled"]',
      'channel = "stable"',
      "enabled = false",
      "",
    ].join("\n"));
  });

  it("removes only enabled when an MCP server inherits global configuration", () => {
    const source = [
      "[mcp_servers.docs]",
      'command = "docs-server"',
      'args = ["--stdio"]',
      "enabled = false",
      "",
      "[mcp_servers.docs.env]",
      'API_MODE = "readonly"',
      "",
    ].join("\n");

    expect(replaceProjectResourceConfig(source, "mcp_servers", [])).toBe([
      "[mcp_servers.docs]",
      'command = "docs-server"',
      'args = ["--stdio"]',
      "",
      "[mcp_servers.docs.env]",
      'API_MODE = "readonly"',
      "",
    ].join("\n"));
  });

  it("adds enabled to an existing MCP table while preserving its URL", () => {
    const source = [
      "[mcp_servers.remote]",
      'url = "https://example.com/mcp"',
      "",
    ].join("\r\n");

    expect(replaceProjectResourceConfig(source, "mcp_servers", [
      { id: "remote", enabled: true },
    ])).toBe([
      "[mcp_servers.remote]",
      "enabled = true",
      'url = "https://example.com/mcp"',
      "",
    ].join("\r\n"));
  });

  it("adds a newline when an existing resource table ends at EOF", () => {
    expect(replaceProjectResourceConfig(
      "[mcp_servers.local]",
      "mcp_servers",
      [{ id: "local", enabled: false }],
    )).toBe([
      "[mcp_servers.local]",
      "enabled = false",
      "",
    ].join("\n"));
  });

  it("creates quoted resource tables for identifiers with punctuation", () => {
    expect(replaceProjectResourceConfig("", "plugins", [
      { id: "browser@openai-bundled", enabled: true },
    ])).toBe([
      '[plugins."browser@openai-bundled"]',
      "enabled = true",
      "",
    ].join("\n"));
  });
});
