import { expect, test } from "@playwright/test";

for (const viewport of [
  { name: "desktop", width: 1440, height: 900 },
  { name: "tablet", width: 1024, height: 768 },
  { name: "mobile", width: 390, height: 844 },
]) {
  test(`${viewport.name} layout has no horizontal overflow`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await page.goto("/tests/e2e/demo.html");
    await expect(page.locator("main.desktop-shell")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });
}

test("profile editor filters skills by source on mobile", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/tests/e2e/demo.html");
  await page.getByRole("button", { name: "编辑 日常开发" }).click();
  await page.getByRole("combobox", { name: "Skill 来源" }).selectOption("system");
  await page.getByRole("textbox", { name: "搜索 skill" }).fill("Code");
  await expect(page.getByText("Code Review", { exact: true })).toHaveCount(1);
  await page.getByRole("button", { name: "全部禁用（1）" }).click();
  await expect(page.getByRole("group", { name: "Code Review 设置" }).getByRole("radio", { name: "停用" })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
});

test("new session overrides use the shared bulk controls", async ({ page }) => {
  await page.goto("/tests/e2e/demo.html");
  await expect(page.locator(".filter-bar").getByRole("textbox", { name: "搜索 skill" })).toBeVisible();
  await expect(page.locator(".command-bar").getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "全部启用（10）" })).toBeVisible();
  await expect(page.getByRole("button", { name: "全部禁用（10）" })).toBeVisible();
});

test("workbench fills the window when no state banner is present", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/tests/e2e/demo.html");
  await expect(page.locator(".skill-row").first()).toBeVisible();
  await expect(page.locator(".state-banner")).toHaveCount(0);

  const layout = await page.evaluate(() => {
    const bounds = (selector: string) =>
      document.querySelector<HTMLElement>(selector)!.getBoundingClientRect();
    const shell = bounds(".desktop-shell");
    const workbench = bounds(".workbench");
    const footer = bounds(".status-bar");
    return {
      footerBottomGap: shell.bottom - footer.bottom,
      footerHeight: footer.height,
      workbenchFooterGap: footer.top - workbench.bottom,
    };
  });

  expect(layout.footerBottomGap).toBeLessThanOrEqual(1);
  expect(layout.footerHeight).toBeLessThanOrEqual(60);
  expect(Math.abs(layout.workbenchFooterGap)).toBeLessThanOrEqual(1);
});

test("project configuration selects from Codex projects", async ({ page }) => {
  await page.goto("/tests/e2e/demo.html");
  await page.getByRole("button", { name: "项目配置" }).click();
  await expect(page.getByRole("button", { name: /Mineradio/ })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "项目根目录" })).toBeVisible();
  await page.screenshot({
    path: "output/project-list.png",
    animations: "disabled",
  });
  await page.getByRole("button", { name: /Mineradio/ }).click();
  await expect(page.getByRole("heading", { name: "Mineradio" })).toBeVisible();
});

test("plugin settings support global toggles and project inheritance", async ({ page }) => {
  await page.goto("/tests/e2e/demo.html");
  await page.getByRole("button", { name: "插件 2" }).click();

  const browserToggle = page.getByRole("checkbox", { name: "Browser 状态" });
  await expect(browserToggle).toBeChecked();
  await browserToggle.locator("..").click();
  await expect(browserToggle).not.toBeChecked();
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(page.getByText("资源配置已保存。")).toBeVisible();

  await page.getByRole("button", { name: "项目 1" }).click();
  const browserSetting = page.getByRole("group", { name: "Browser 设置" });
  await expect(browserSetting.getByRole("radio", { name: "继承" })).toBeChecked();
  await browserSetting.getByRole("radio", { name: "停用" }).locator("..").click();
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(browserSetting.getByRole("radio", { name: "停用" })).toBeChecked();
});

test("MCP settings support global and project controls", async ({ page }) => {
  await page.goto("/tests/e2e/demo.html");
  await page.getByRole("button", { name: "MCP 2" }).click();

  const localToggle = page.getByRole("checkbox", { name: "local-tools 状态" });
  await localToggle.locator("..").click();
  await expect(localToggle).not.toBeChecked();
  await page.getByRole("button", { name: "保存配置" }).click();
  await page.getByRole("button", { name: "项目 1" }).click();
  const setting = page.getByRole("group", { name: "local-tools 设置" });
  await expect(setting.getByRole("radio", { name: "停用" })).toBeChecked();
  await setting.getByRole("radio", { name: "继承" }).locator("..").click();
  await page.getByRole("button", { name: "保存配置" }).click();
  await expect(setting.getByRole("radio", { name: "继承" })).toBeChecked();
});
