import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { _electron as electron, expect, test } from "@playwright/test";

test("launches a secure, nonblank desktop workbench", async () => {
  const projectRoot = resolve(import.meta.dirname, "../..");
  const dataRoot = await mkdtemp(join(tmpdir(), "skill-session-profiles-electron-"));
  const packagedExecutable = process.env.PACKAGED_APP;
  const electronApp = await electron.launch({
    ...(packagedExecutable
      ? { executablePath: packagedExecutable, args: [] }
      : { args: [projectRoot] }),
    env: {
      ...process.env,
      SKILL_SESSION_PROFILES_DATA: dataRoot,
      SKILL_SESSION_PROFILES_CWD: projectRoot,
    },
  });

  try {
    const window = await electronApp.firstWindow();
    await window.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
    await window.evaluate(() => {
      localStorage.setItem("skill-session-profiles:language", "zh");
      localStorage.setItem("skill-session-profiles:theme", "light");
    });
    await window.reload();
    await expect(window.getByText("Skill Session Profiles", { exact: true })).toBeVisible();
    await expect(window.getByRole("button", { name: "应用此配置" })).toBeVisible();
    await expect(window.getByRole("button", { name: "Switch to English" })).toBeVisible();
    await expect(window.locator(".skill-row").first()).toBeVisible({ timeout: 20_000 });
    await window.getByRole("button", { name: "项目配置" }).click();
    await expect(window.locator(".profile-rail").getByRole("button", {
      name: /skill-session-profile/,
    })).toBeVisible();
    await window.getByRole("button", { name: "任务配置" }).click();

    const runtime = await window.evaluate(() => {
      const bounds = (selector: string) =>
        document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
      const shell = bounds(".desktop-shell");
      const workbench = bounds(".workbench");
      const footer = bounds(".status-bar");
      return {
        nodeProcess: typeof (globalThis as unknown as { process?: unknown }).process,
        nodeRequire: typeof (globalThis as unknown as { require?: unknown }).require,
        desktopBridge: typeof (globalThis as unknown as { skillSessionProfiles?: unknown }).skillSessionProfiles,
        horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        footerBottomGap: shell.bottom - footer.bottom,
        footerHeight: footer.height,
        workbenchFooterGap: footer.top - workbench.bottom,
      };
    });
    expect({
      nodeProcess: runtime.nodeProcess,
      nodeRequire: runtime.nodeRequire,
      desktopBridge: runtime.desktopBridge,
      horizontalOverflow: runtime.horizontalOverflow,
    }).toEqual({
      nodeProcess: "undefined",
      nodeRequire: "undefined",
      desktopBridge: "object",
      horizontalOverflow: 0,
    });
    expect(runtime.footerBottomGap).toBeLessThanOrEqual(1);
    expect(runtime.footerHeight).toBeLessThanOrEqual(60);
    expect(Math.abs(runtime.workbenchFooterGap)).toBeLessThanOrEqual(1);

    await window.keyboard.press("Meta+K");
    await expect(window.getByRole("textbox", { name: "搜索 skill" })).toBeFocused();
    await window.screenshot({
      path: resolve(projectRoot, "output", "electron-preview.png"),
      animations: "disabled",
    });
    await window.getByRole("button", { name: "切换到黑夜模式" }).click();
    await expect(window.locator("body")).toHaveCSS("background-color", "rgb(13, 13, 15)");
    await window.screenshot({
      path: resolve(projectRoot, "output", "electron-preview-dark.png"),
      animations: "disabled",
    });
    await window.getByRole("button", { name: "Switch to English" }).click();
    await expect(window.getByRole("button", { name: "Task Configuration" })).toBeVisible();
  } finally {
    await electronApp.close();
    await rm(dataRoot, { recursive: true, force: true });
  }
});
