import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { expect, it } from "vitest";

import { AppServerClient } from "../src/server/app-server-client.js";

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
