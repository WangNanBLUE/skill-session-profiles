import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { AppServerClient } from "../../src/server/app-server-client.js";
import { JsonStore } from "../../src/server/json-store.js";
import { ProfileService } from "../../src/server/profile-service.js";

it("reads Codex state without an app-server control socket", async () => {
  const codexHome = await mkdtemp(join(tmpdir(), "skill-profiles-codex-home-"));
  const previousCodexHome = process.env.CODEX_HOME;
  process.env.CODEX_HOME = codexHome;
  const client = new AppServerClient();

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
    await rm(codexHome, { recursive: true, force: true });
  }
});

it("saves project skill configuration through the real app-server filesystem API", async () => {
  const projectRoot = await mkdtemp(join(tmpdir(), "skill-profiles-project-"));
  const dataRoot = await mkdtemp(join(tmpdir(), "skill-profiles-data-"));
  const projectConfig = join(projectRoot, ".codex", "config.toml");
  await mkdir(join(projectRoot, ".codex"));
  await writeFile(projectConfig, '# Preserve this comment\nmodel = "gpt-5"\n');
  const client = new AppServerClient();
  const service = new ProfileService(client, new JsonStore(dataRoot));

  try {
    const inventory = await client.listSkills([projectRoot], true);
    const skillPath = inventory.data[0]?.skills[0]?.path;
    expect(skillPath).toBeDefined();
    await expect(service.saveProjectConfiguration(projectRoot, [
      { path: skillPath as string, state: "disabled" },
    ])).resolves.toEqual([{ path: skillPath as string, enabled: false }]);
    await expect(readFile(projectConfig, "utf8")).resolves.toContain(
      `# Preserve this comment\nmodel = "gpt-5"\n\n[[skills.config]]\npath = ${JSON.stringify(skillPath)}`,
    );
  } finally {
    await client.close();
    await Promise.all([
      rm(projectRoot, { recursive: true, force: true }),
      rm(dataRoot, { recursive: true, force: true }),
    ]);
  }
});
