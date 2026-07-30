import { chmod, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

import { afterEach, expect, it } from "vitest";

import { codexChildEnvironment } from "../src/server/app-server-client.js";

const execFileAsync = promisify(execFile);
const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

it("runs a node-based Codex launcher when the GUI PATH omits Node", async () => {
  const root = await mkdtemp(join(tmpdir(), "codex-launcher-"));
  roots.push(root);
  const command = join(root, "codex");
  await writeFile(command, "#!/usr/bin/env node\nprocess.stdout.write('ok');\n");
  await chmod(command, 0o755);
  await symlink(process.execPath, join(root, "node"));

  const { stdout } = await execFileAsync(command, [], {
    env: codexChildEnvironment(command, { PATH: "/usr/bin:/bin" }),
  });

  expect(stdout).toBe("ok");
});
