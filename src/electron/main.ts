import { writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  nativeTheme,
  type IpcMainInvokeEvent,
  type OpenDialogOptions,
  type SaveDialogOptions,
} from "electron";

import {
  AppServerClient,
  CodexAppServerLineTransport,
} from "../server/app-server-client.js";
import { SkillProfileBackend } from "../server/backend.js";
import { prepareSharedDataRoot } from "../server/data-root.js";
import { JsonStore } from "../server/json-store.js";
import { resolveCodexCommand } from "./codex-command.js";

const moduleRoot = dirname(fileURLToPath(import.meta.url));
const rendererPath = resolve(moduleRoot, "../desktop/desktop.html");
const rendererUrl = pathToFileURL(rendererPath).toString();
let mainWindow: BrowserWindow | null = null;
let backendPromise: Promise<SkillProfileBackend> | undefined;
let client: AppServerClient | undefined;

function getBackend(): Promise<SkillProfileBackend> {
  backendPromise ??= Promise.all([
    resolveCodexCommand(),
    prepareSharedDataRoot(),
  ]).then(([codexCommand, dataRoot]) => {
    client = new AppServerClient(new CodexAppServerLineTransport(codexCommand));
    return new SkillProfileBackend(client, new JsonStore(dataRoot));
  });
  return backendPromise;
}

function requireTrustedRenderer(event: IpcMainInvokeEvent): void {
  if (event.senderFrame?.url !== rendererUrl) {
    throw new Error("Blocked IPC request from an untrusted renderer");
  }
}

function registerIpc(): void {
  ipcMain.handle(
    "skill-profiles:call",
    async (event, name: unknown, args: unknown) => {
      requireTrustedRenderer(event);
      if (typeof name !== "string" || typeof args !== "object" || args === null) {
        throw new Error("Invalid Skill Session Profiles request");
      }
      return (await getBackend()).call(name, args as Record<string, unknown>);
    },
  );
  ipcMain.handle("skill-profiles:get-context", (event) => {
    requireTrustedRenderer(event);
    return {
      cwd: process.env.SKILL_SESSION_PROFILES_CWD ?? app.getPath("home"),
    };
  });
  ipcMain.handle("skill-profiles:choose-directory", async (event) => {
    requireTrustedRenderer(event);
    const options: OpenDialogOptions = {
      title: "选择 Codex 任务目录",
      properties: ["openDirectory", "createDirectory"],
    };
    const result = mainWindow
      ? await dialog.showOpenDialog(mainWindow, options)
      : await dialog.showOpenDialog(options);
    return result.canceled ? null : result.filePaths[0] ?? null;
  });
  ipcMain.handle(
    "skill-profiles:save-text-file",
    async (event, defaultName: unknown, content: unknown) => {
      requireTrustedRenderer(event);
      if (
        typeof defaultName !== "string"
        || !/^[a-zA-Z0-9._-]{1,120}$/.test(defaultName)
        || typeof content !== "string"
        || Buffer.byteLength(content) > 5 * 1024 * 1024
      ) {
        throw new Error("Invalid export request");
      }
      const options: SaveDialogOptions = {
        title: "导出配置方案",
        defaultPath: defaultName,
        filters: [{ name: "JSON", extensions: ["json"] }],
      };
      const result = mainWindow
        ? await dialog.showSaveDialog(mainWindow, options)
        : await dialog.showSaveDialog(options);
      if (result.canceled || !result.filePath) return false;
      await writeFile(result.filePath, content, { encoding: "utf8", mode: 0o600 });
      return true;
    },
  );
}

function createWindow(): void {
  const window = new BrowserWindow({
    title: "Skill Session Profiles",
    width: 1280,
    height: 820,
    minWidth: 860,
    minHeight: 600,
    backgroundColor: nativeTheme.shouldUseDarkColors ? "#0d0d0f" : "#f7f7f8",
    show: false,
    webPreferences: {
      preload: resolve(moduleRoot, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== rendererUrl) event.preventDefault();
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) mainWindow = null;
  });
  void window.loadFile(rendererPath);
  mainWindow = window;
}

nativeTheme.themeSource = "system";
registerIpc();

void app.whenReady().then(() => {
  createWindow();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
app.on("before-quit", () => {
  void client?.close();
});
