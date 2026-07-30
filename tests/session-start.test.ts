import { describe, expect, it, vi } from "vitest";

import {
  renderProjectSkillPolicy,
  runSessionStart,
} from "../src/hook/session-start.js";

describe("runSessionStart", () => {
  it.each(["clear", "compact"])("does not consume on %s", async (source) => {
    const client = { close: vi.fn() };
    const store = { readPending: vi.fn() };
    const result = await runSessionStart(
      { hook_event_name: "SessionStart", session_id: "s1", cwd: "/repo", source },
      { client: client as never, store: store as never },
    );
    expect(result).toEqual({ consumed: false });
    expect(store.readPending).not.toHaveBeenCalled();
  });

  it("adds an authoritative project policy without rewriting user defaults", async () => {
    const client = {
      canBatchWrite: vi.fn().mockResolvedValue(false),
      listSkills: vi.fn().mockResolvedValue({
        data: [{
          cwd: "/repo",
          skills: [
            {
              name: "review",
              description: "Review changes.",
              path: "/skills/review/SKILL.md",
              scope: "user",
              enabled: true,
            },
            {
              name: "deploy",
              description: "Deploy the application.",
              path: "/skills/deploy/SKILL.md",
              scope: "user",
              enabled: false,
            },
          ],
          errors: [],
        }],
      }),
      readConfig: vi.fn().mockResolvedValue({
        config: {},
        origins: {},
        layers: [
          {
            name: { type: "user", profile: null },
            version: "user-v1",
            config: {
              skills: {
                config: [
                  { path: "/skills/review/SKILL.md", enabled: true },
                  { path: "/skills/deploy/SKILL.md", enabled: false },
                ],
              },
            },
          },
          {
            name: { type: "project", dotCodexFolder: "/repo/.codex" },
            version: "project-v1",
            config: {
              skills: {
                config: [
                  { path: "/skills/review/SKILL.md", enabled: false },
                  { path: "/skills/deploy/SKILL.md", enabled: true },
                ],
              },
            },
          },
        ],
      }),
      batchWriteSkillsConfig: vi.fn(),
      close: vi.fn(),
    };
    const store = {
      withLock: async (operation: () => Promise<unknown>) => operation(),
      readPending: vi.fn().mockResolvedValue(undefined),
    };

    const result = await runSessionStart(
      { hook_event_name: "SessionStart", session_id: "s1", cwd: "/repo", source: "startup" },
      { client: client as never, store: store as never },
    );

    expect(result.consumed).toBe(false);
    expect(result.projectContext).toContain("Effective enabled skills (authoritative): `deploy`.");
    expect(result.projectContext).not.toContain("authoritative): `review`");
    expect(result.projectContext).toContain("Deploy the application.");
    expect(client.batchWriteSkillsConfig).not.toHaveBeenCalled();
  });
});

describe("renderProjectSkillPolicy", () => {
  it("returns no context when the project has no skill overrides", () => {
    expect(renderProjectSkillPolicy("/repo", [], [], [])).toBeUndefined();
  });

  it("states that no skills are enabled when the project disables the inventory", () => {
    const context = renderProjectSkillPolicy(
      "/repo",
      [{
        name: "review",
        description: "Review changes.",
        path: "/skills/review/SKILL.md",
        scope: "user",
        enabled: true,
      }],
      [{ path: "/skills/review/SKILL.md", enabled: true }],
      [{ path: "/skills/review/SKILL.md", enabled: false }],
    );

    expect(context).toContain("Effective enabled skills (authoritative): none.");
    expect(context).toContain("Do not invoke or read any skill not in this exact set");
  });
});
