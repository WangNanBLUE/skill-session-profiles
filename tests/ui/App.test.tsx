import { cleanup, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { App } from "../../src/ui/App.js";

const state = {
  skills: [
    { name: "Review", description: "Code checks", path: "/skills/review/SKILL.md", scope: "user", enabled: true },
    { name: "Deploy", description: "Review releases", path: "/skills/deploy/SKILL.md", scope: "repo", enabled: true },
    { name: "Report", description: "Status", path: "/skills/report/SKILL.md", scope: "user", enabled: false },
  ],
  globalDefaults: [
    { path: "/skills/review/SKILL.md", enabled: true },
    { path: "/skills/deploy/SKILL.md", enabled: true },
    { path: "/skills/report/SKILL.md", enabled: false },
  ],
  profiles: [{
    id: "p1", name: "Daily", overrides: [
      { path: "/skills/deploy/SKILL.md", state: "enabled" },
      { path: "/skills/removed/SKILL.md", state: "disabled" },
    ],
    createdAt: "2026-07-28T00:00:00.000Z", updatedAt: "2026-07-28T00:00:00.000Z",
  }],
  pending: null,
  writable: true,
};

const preferences = new Map<string, string>();

beforeEach(() => {
  preferences.clear();
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => preferences.get(key) ?? null,
      setItem: (key: string, value: string) => preferences.set(key, value),
      clear: () => preferences.clear(),
    },
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  delete document.documentElement.dataset.theme;
});

function createApi() {
  return {
    call: vi.fn(async (name: string, args: Record<string, unknown>) => {
      if (name === "get_skill_profile_state") return state;
      if (name === "save_skill_profile") {
        return {
          profile: {
            id: (args.id as string | undefined) ?? "new-profile",
            name: args.name,
            overrides: args.overrides,
            createdAt: "2026-07-28T00:00:00.000Z",
            updatedAt: "2026-07-28T00:00:00.000Z",
          },
        };
      }
      return {};
    }),
  };
}

describe("Skill Session Profiles panel", () => {
  it("switches language and theme and remembers both preferences", async () => {
    const api = createApi();
    render(<App api={api} cwd="/repo" />);
    await screen.findByText("Skill Session Profiles");

    await userEvent.click(screen.getByRole("button", { name: "Switch to English" }));
    expect(screen.getByRole("button", { name: "Task Configuration" })).toBeTruthy();
    expect(localStorage.getItem("skill-session-profiles:language")).toBe("en");

    await userEvent.click(screen.getByRole("button", { name: "Switch to dark mode" }));
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("skill-session-profiles:theme")).toBe("dark");
  });

  it("offers complete profile management actions", async () => {
    const api = createApi();
    render(<App api={api} cwd="/repo" />);
    await screen.findByText("Skill Session Profiles");
    await userEvent.click(screen.getByRole("button", { name: "配置方案" }));
    expect(screen.getByRole("button", { name: "编辑 Daily" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "复制 Daily" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导入" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "导出" })).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "编辑 Daily" }));
    expect(screen.getByRole("combobox", { name: "Skill 来源" })).toBeTruthy();
  });

  it("searches shared skill configuration by name only", async () => {
    const api = createApi();
    render(<App api={api} cwd="/repo" />);
    await screen.findByText("Skill Session Profiles");

    const search = screen.getByRole("textbox", { name: "搜索 skill" });
    await userEvent.type(search, "Code checks");

    expect(screen.queryByText("Review", { exact: true })).toBeNull();
    expect(screen.getByText("没有匹配的 Skill")).toBeTruthy();
    expect((screen.getByRole("button", { name: "全部启用（0）" }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "全部禁用（0）" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("bulk-disables only visible skills and preserves hidden overrides", async () => {
    const api = createApi();
    render(<App api={api} cwd="/repo" />);
    await screen.findByText("Skill Session Profiles");
    await userEvent.click(screen.getByRole("button", { name: "配置方案" }));
    await userEvent.click(screen.getByRole("button", { name: "编辑 Daily" }));
    await userEvent.selectOptions(
      screen.getByRole("combobox", { name: "Skill 来源" }),
      "user",
    );
    await userEvent.type(
      screen.getByRole("textbox", { name: "搜索 skill" }),
      "Re",
    );
    await userEvent.click(screen.getByRole("button", { name: "全部禁用（2）" }));
    await userEvent.click(screen.getByRole("button", { name: "保存方案" }));

    expect(api.call).toHaveBeenCalledWith("save_skill_profile", {
      id: "p1",
      name: "Daily",
      overrides: [
        { path: "/skills/deploy/SKILL.md", state: "enabled" },
        { path: "/skills/removed/SKILL.md", state: "disabled" },
        { path: "/skills/review/SKILL.md", state: "disabled" },
        { path: "/skills/report/SKILL.md", state: "disabled" },
      ],
    });
  });

  it("persists the selected profile for all later tasks", async () => {
    const api = createApi();
    render(<App api={api} cwd="/repo" />);
    await screen.findByText("Skill Session Profiles");
    await userEvent.click(screen.getByRole("button", { name: /Daily1 当前 · 1 失效/ }));
    await userEvent.click(screen.getByRole("button", { name: "应用此配置" }));

    expect(api.call).toHaveBeenCalledWith("apply_skill_configuration", {
      cwd: "/repo",
      overrides: [{ path: "/skills/deploy/SKILL.md", state: "enabled" }],
    });
    expect(screen.getByText("配置已应用。后续打开的所有任务都会沿用此配置。")).toBeTruthy();
  });

  it("cleans stale profile overrides only when the edited profile is saved", async () => {
    const api = createApi();
    render(<App api={api} cwd="/repo" />);
    await screen.findByText("Skill Session Profiles");
    await userEvent.click(screen.getByRole("button", { name: "配置方案" }));
    await userEvent.click(screen.getByRole("button", { name: "编辑 Daily" }));

    expect(screen.getByText("1 项覆盖已不在当前 Skill 列表中。")).toBeTruthy();
    await userEvent.click(screen.getByRole("button", { name: "清理失效覆盖（1）" }));
    expect(screen.queryByText("1 项覆盖已不在当前 Skill 列表中。")).toBeNull();
    await userEvent.click(screen.getByRole("button", { name: "保存方案" }));

    expect(api.call).toHaveBeenCalledWith("save_skill_profile", {
      id: "p1",
      name: "Daily",
      overrides: [{ path: "/skills/deploy/SKILL.md", state: "enabled" }],
    });
  });
});
