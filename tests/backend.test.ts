import { expect, it } from "vitest";

import { SkillProfileBackend } from "../src/server/backend.js";
import { JsonStore } from "../src/server/json-store.js";
import type { AppServerClient } from "../src/server/app-server-client.js";

it("rejects renderer calls outside the explicit backend allowlist", async () => {
  const backend = new SkillProfileBackend(
    {} as AppServerClient,
    new JsonStore("/unused"),
  );

  await expect(backend.call("run_arbitrary_command", {})).rejects.toThrow();
});
