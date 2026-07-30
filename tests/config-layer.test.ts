import { describe, expect, it } from "vitest";

import { extractProjectSkillLayer, extractUserSkillLayer } from "../src/server/config-layer.js";
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
