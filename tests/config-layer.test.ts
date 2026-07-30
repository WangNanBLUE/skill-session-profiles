import { describe, expect, it } from "vitest";

import {
  extractProjectResourceLayer,
  extractProjectSkillLayer,
  extractUserResourceLayer,
  extractUserSkillLayer,
} from "../src/server/config-layer.js";
import type { ConfigReadResponse } from "../src/shared/contracts.js";

describe("extractUserSkillLayer", () => {
  it("reads only the base user layer", () => {
    const response: ConfigReadResponse = {
      config: {}, origins: {},
      layers: [
        { name: { type: "project" }, version: "project", config: { skills: { config: [{ path: "/project", enabled: false }] } } },
        { name: { type: "user", profile: "work" }, version: "profile", config: { skills: { config: [{ path: "/profile", enabled: false }] } } },
        { name: { type: "user", profile: null }, version: "user-v1", config: { skills: { config: [{ path: "/user", enabled: true }] } } },
      ],
    };
    expect(extractUserSkillLayer(response)).toEqual({
      version: "user-v1",
      value: [{ path: "/user", enabled: true }],
    });
  });

  it("preserves valid name-based skill selectors", () => {
    const response: ConfigReadResponse = {
      config: {}, origins: {},
      layers: [{
        name: { type: "user", profile: null },
        version: "user-v1",
        config: { skills: { config: [{ name: "skill-creator", enabled: false }] } },
      }],
    };

    expect(extractUserSkillLayer(response)).toEqual({
      version: "user-v1",
      value: [{ name: "skill-creator", enabled: false }],
    });
  });
});

it("resolves the nearest project skill layer or the selected project path", () => {
  const response: ConfigReadResponse = {
    config: {}, origins: {},
    layers: [{
      name: { type: "project", dotCodexFolder: "/repo/.codex" },
      version: "project-v1",
      config: { skills: { config: [{ path: "/project", enabled: false }] } },
    }],
  };
  expect(extractProjectSkillLayer(response, "/repo/packages/app")).toEqual({
    version: "project-v1",
    value: [{ path: "/project", enabled: false }],
    filePath: "/repo/.codex/config.toml",
  });
  expect(extractProjectSkillLayer({ ...response, layers: [] }, "/new-repo")).toEqual({
    version: null,
    value: [],
    filePath: "/new-repo/.codex/config.toml",
  });
});

it("ignores disabled project layers", () => {
  const response: ConfigReadResponse = {
    config: {}, origins: {},
    layers: [{
      name: { type: "project", dotCodexFolder: "/repo/.codex" },
      version: "project-v1",
      disabledReason: "project is not trusted",
      config: { skills: { config: [{ path: "/project", enabled: false }] } },
    }],
  };

  expect(extractProjectSkillLayer(response, "/repo")).toEqual({
    version: null,
    value: [],
    filePath: "/repo/.codex/config.toml",
  });
});

it("extracts only explicit plugin and MCP enabled fields from each layer", () => {
  const response: ConfigReadResponse = {
    config: {}, origins: {},
    layers: [
      {
        name: { type: "user", profile: null },
        version: "user-v2",
        config: {
          plugins: {
            "browser@openai-bundled": { enabled: false, channel: "stable" },
            "without-toggle": { channel: "preview" },
          },
          mcp_servers: {
            docs: { enabled: true, url: "https://example.com/mcp" },
          },
        },
      },
      {
        name: { type: "project", dotCodexFolder: "/repo/.codex" },
        version: "project-v2",
        config: {
          plugins: {
            "browser@openai-bundled": { enabled: true },
          },
          mcp_servers: {
            docs: { enabled: false, command: "docs-server" },
          },
        },
      },
    ],
  };

  expect(extractUserResourceLayer(response, "plugins")).toEqual({
    version: "user-v2",
    value: [{ id: "browser@openai-bundled", enabled: false }],
  });
  expect(extractUserResourceLayer(response, "mcp_servers")).toEqual({
    version: "user-v2",
    value: [{ id: "docs", enabled: true }],
  });
  expect(extractProjectResourceLayer(response, "/repo", "plugins")).toEqual({
    version: "project-v2",
    filePath: "/repo/.codex/config.toml",
    value: [{ id: "browser@openai-bundled", enabled: true }],
  });
  expect(extractProjectResourceLayer(response, "/repo", "mcp_servers")).toEqual({
    version: "project-v2",
    filePath: "/repo/.codex/config.toml",
    value: [{ id: "docs", enabled: false }],
  });
});
