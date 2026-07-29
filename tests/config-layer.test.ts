import { describe, expect, it } from "vitest";

import { extractUserSkillLayer } from "../src/server/config-layer.js";
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
