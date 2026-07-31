import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join, win32 } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

export async function resolveCodexCommand(
  platform: NodeJS.Platform = process.platform,
  architecture: NodeJS.Architecture = process.arch,
): Promise<string> {
  const home = homedir();
  const configured = process.env.CODEX_BINARY ?? process.env.CODEX_BIN;
  const platformSpecificCandidates = platform === "win32"
    ? await windowsCodexCandidates(home, architecture)
    : [];
  const candidates = [
    configured,
    ...pathCandidates(process.env.PATH, platform),
    ...platformSpecificCandidates,
    "/opt/homebrew/bin/codex",
    "/usr/local/bin/codex",
    "/Applications/ChatGPT.app/Contents/Resources/codex",
    join(home, "Applications", "ChatGPT.app", "Contents", "Resources", "codex"),
    join(home, ".local", "bin", "codex"),
    join(home, ".volta", "bin", "codex"),
    join(home, ".asdf", "shims", "codex"),
    join(home, ".local", "share", "mise", "shims", "codex"),
    join(home, ".bun", "bin", "codex"),
    ...await nvmCandidates(join(home, ".nvm", "versions", "node")),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (await isExecutable(candidate)) return candidate;
  }

  if (platform === "win32") {
    throw new Error(
      "找不到 Codex CLI。请先安装 Codex，或设置 CODEX_BINARY 为 codex.exe 或 codex.cmd 的绝对路径。",
    );
  }

  try {
    const { stdout } = await execFileAsync("/bin/zsh", ["-lic", "command -v codex"], {
      timeout: 3_000,
      maxBuffer: 16_384,
    });
    const command = stdout.trim().split("\n").at(-1);
    if (command && command.startsWith("/") && await isExecutable(command)) return command;
  } catch {
    // The actionable error below covers missing or broken shell configuration.
  }

  throw new Error(
    "找不到 Codex CLI。请先安装 Codex，或设置 CODEX_BINARY 为 codex 可执行文件的绝对路径。",
  );
}

async function windowsCodexCandidates(
  home: string,
  architecture: NodeJS.Architecture,
): Promise<string[]> {
  const roamingAppData = process.env.APPDATA
    ?? win32.join(home, "AppData", "Roaming");
  const localAppData = process.env.LOCALAPPDATA
    ?? win32.join(home, "AppData", "Local");
  const npmPrefixes = [
    process.env.NPM_CONFIG_PREFIX,
    win32.join(roamingAppData, "npm"),
  ].filter((value): value is string => Boolean(value));
  const desktopCacheRoot = win32.join(localAppData, "OpenAI", "Codex", "bin");

  return [
    ...npmPrefixes.flatMap((prefix) => npmCodexCandidates(prefix, architecture)),
    ...await versionedWindowsCandidates(desktopCacheRoot),
    win32.join(localAppData, "Programs", "Codex", "codex.exe"),
  ];
}

function npmCodexCandidates(
  prefix: string,
  architecture: NodeJS.Architecture,
): string[] {
  const architectureNames = architecture === "x64"
    ? { package: "x64", target: "x86_64" }
    : architecture === "arm64"
    ? { package: "arm64", target: "aarch64" }
    : undefined;
  const nativeBinary = architectureNames === undefined
    ? []
    : [win32.join(
        prefix,
        "node_modules",
        "@openai",
        "codex",
        "node_modules",
        "@openai",
        `codex-win32-${architectureNames.package}`,
        "vendor",
        `${architectureNames.target}-pc-windows-msvc`,
        "bin",
        "codex.exe",
      )];

  return [
    ...nativeBinary,
    win32.join(prefix, "codex.exe"),
    win32.join(prefix, "codex.cmd"),
    win32.join(prefix, "codex"),
  ];
}

async function versionedWindowsCandidates(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => win32.join(root, entry.name, "codex.exe"))
      .sort((a, b) => b.localeCompare(a));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EACCES") return [];
    throw error;
  }
}

function pathCandidates(
  pathValue: string | undefined,
  platform: NodeJS.Platform,
): string[] {
  const commandNames = platform === "win32"
    ? ["codex.exe", "codex.cmd", "codex"]
    : ["codex"];
  const pathDelimiter = platform === "win32" ? win32.delimiter : delimiter;
  const joinPath = platform === "win32" ? win32.join : join;
  return (pathValue ?? "")
    .split(pathDelimiter)
    .filter(Boolean)
    .flatMap((entry) => commandNames.map((name) => joinPath(entry, name)));
}

async function nvmCandidates(root: string): Promise<string[]> {
  try {
    return (await readdir(root, { withFileTypes: true }))
      .filter((entry) => entry.isDirectory())
      .map((entry) => join(root, entry.name, "bin", "codex"))
      .sort((a, b) => b.localeCompare(a));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return [];
    throw error;
  }
}

async function isExecutable(path: string): Promise<boolean> {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
