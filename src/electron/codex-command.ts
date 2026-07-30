import { constants } from "node:fs";
import { access, readdir } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execFileAsync = promisify(execFile);

export async function resolveCodexCommand(): Promise<string> {
  const home = homedir();
  const configured = process.env.CODEX_BINARY ?? process.env.CODEX_BIN;
  const candidates = [
    configured,
    ...pathCandidates(process.env.PATH),
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

function pathCandidates(pathValue: string | undefined): string[] {
  return (pathValue ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((entry) => join(entry, "codex"));
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
