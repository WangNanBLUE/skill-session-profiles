import { expect, it } from "vitest";

import {
  parseProjectSkillPolicy,
  readProjectSkillPolicy,
  replaceProjectSkillPolicy,
} from "../src/server/project-agents.js";
import type { AppServerClient } from "../src/server/app-server-client.js";

it("round-trips managed project Skill policy while preserving other guidance", () => {
  const source = "# Existing rules\n\n- Keep this.\n";
  const entries = [{ path: "/skills/review/SKILL.md", enabled: false }];
  const updated = replaceProjectSkillPolicy(
    source,
    entries,
    new Map([["/skills/review/SKILL.md", "Review"]]),
  );

  expect(updated).toContain(source);
  expect(updated).toContain("Do not invoke or read `Review`");
  expect(parseProjectSkillPolicy(updated)).toEqual(entries);
});

it("removes only the managed block when project overrides are cleared", () => {
  const source = replaceProjectSkillPolicy(
    "# Existing rules\n",
    [{ path: "/skills/review/SKILL.md", enabled: true }],
    new Map(),
  );

  expect(replaceProjectSkillPolicy(source, [], new Map())).toBe("# Existing rules\n");
});

it("uses an existing AGENTS.override.md because Codex gives it precedence", async () => {
  const client = {
    readDirectory: async () => [
      { fileName: "AGENTS.md", isFile: true, isDirectory: false },
      { fileName: "AGENTS.override.md", isFile: true, isDirectory: false },
    ],
    readFile: async () => "# Active override\n",
  } as unknown as AppServerClient;

  await expect(readProjectSkillPolicy(client, "/repo")).resolves.toMatchObject({
    filePath: "/repo/AGENTS.override.md",
    source: "# Active override\n",
  });
});
