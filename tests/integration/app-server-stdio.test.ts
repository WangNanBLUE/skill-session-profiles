import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import {
  AppServerClient,
  CodexAppServerLineTransport,
} from "../../src/server/app-server-client.js";
import { resolveCodexCommand } from "../../src/electron/codex-command.js";
import { JsonStore } from "../../src/server/json-store.js";
import { ProfileService } from "../../src/server/profile-service.js";

function removeTemporaryDirectory(path: string): Promise<void> {
  return rm(path, {
    recursive: true,
    force: true,
    maxRetries: 10,
    retryDelay: 100,
  });
}

it("reads Codex state without an app-server control socket", async () => {
  const codexHome = await mkdtemp(join(tmpdir(), "skill-profiles-codex-home-"));
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  const client = new AppServerClient(
    new CodexAppServerLineTransport(await resolveCodexCommand()),
  );

  try {
    const [skills, config] = await Promise.all([
      client.listSkills([process.cwd()]),
      client.readConfig(process.cwd()),
    ]);
    expect(skills.data).toBeDefined();
    expect(config).toBeDefined();
  } finally {
    await client.close();
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    await removeTemporaryDirectory(codexHome);
  }
});

it("saves project skill policy to AGENTS.md through the real app-server filesystem API", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "skill-profiles-project-"));
  const dataRoot = await mkdtemp(join(tmpdir(), "skill-profiles-data-"));
  const codexHome = await mkdtemp(join(tmpdir(), "skill-profiles-codex-home-"));
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  await writeFile(
    join(codexHome, "config.toml"),
    `[projects.${JSON.stringify(await realpath(projectRoot))}]\ntrust_level = "trusted"\n`,
  );
  const agentsFile = join(projectRoot, "AGENTS.md");
  await writeFile(agentsFile, "# Preserve this guidance\n");
  const client = new AppServerClient(
    new CodexAppServerLineTransport(await resolveCodexCommand()),
  );
  const service = new ProfileService(client, new JsonStore(dataRoot));

  try {
    const inventory = await client.listSkills([projectRoot], true);
    const skillPath = inventory.data[0]?.skills[0]?.path;
    expect(skillPath).toBeDefined();
    await expect(service.saveProjectConfiguration(projectRoot, [
      { path: skillPath as string, state: "disabled" },
    ])).resolves.toEqual([{ path: skillPath as string, enabled: false }]);
    await expect(readFile(agentsFile, "utf8")).resolves.toContain(
      `# Preserve this guidance\n\n<!-- skill-session-profiles:start -->`,
    );
    await expect(readFile(agentsFile, "utf8")).resolves.toContain(
      `Do not invoke or read`,
    );
  } finally {
    await client.close();
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    await Promise.all([
      removeTemporaryDirectory(projectRoot),
      removeTemporaryDirectory(dataRoot),
      removeTemporaryDirectory(codexHome),
    ]);
  }
});

it("disables a skill when user config uses its full SKILL.md path", async () => {
  const codexHome = await mkdtemp(join(tmpdir(), "skill-profiles-codex-home-"));
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  const userSkillDirectory = join(codexHome, "skills", "integration-skill");
  await mkdir(userSkillDirectory, { recursive: true });
  await writeFile(
    join(userSkillDirectory, "SKILL.md"),
    [
      "---",
      "name: integration-skill",
      "description: Integration test skill.",
      "---",
      "",
      "# Integration skill",
      "",
    ].join("\n"),
  );
  const codexCommand = await resolveCodexCommand();
  let client = new AppServerClient(new CodexAppServerLineTransport(codexCommand));

  try {
    const inventory = await client.listSkills([process.cwd()], true);
    const skillPath = inventory.data[0]?.skills.find(
      (skill) => skill.scope === "user",
    )?.path;
    expect(skillPath).toBeDefined();
    await client.close();

    await writeFile(
      join(codexHome, "config.toml"),
      `[[skills.config]]\npath = ${JSON.stringify(skillPath)}\nenabled = false\n`,
    );
    client = new AppServerClient(new CodexAppServerLineTransport(codexCommand));
    const updatedInventory = await client.listSkills([process.cwd()], true);
    expect(updatedInventory.data[0]?.skills.find(
      (skill) => skill.path === skillPath,
    )?.enabled).toBe(false);
  } finally {
    await client.close();
    if (previousCodexHome === undefined) {
      delete process.env.CODEX_HOME;
    } else {
      process.env.CODEX_HOME = previousCodexHome;
    }
    await removeTemporaryDirectory(codexHome);
  }
});
