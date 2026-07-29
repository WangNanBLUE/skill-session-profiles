import { resolve } from "node:path";

import { AppServerClient } from "../server/app-server-client.js";
import { prepareSharedDataRoot } from "../server/data-root.js";
import { JsonStore } from "../server/json-store.js";
import { ProfileService } from "../server/profile-service.js";

interface HookInput {
  hook_event_name: "SessionStart";
  session_id: string;
  cwd: string;
  source: string;
}

export async function runSessionStart(
  input: HookInput,
  dependencies?: { client: AppServerClient; store: JsonStore },
) {
  if (!["startup", "resume"].includes(input.source)) return { consumed: false };
  const client = dependencies?.client ?? new AppServerClient();
  const store = dependencies?.store ?? new JsonStore(await prepareSharedDataRoot([
    process.env.PLUGIN_DATA ?? resolve(process.cwd(), ".plugin-data"),
  ]));
  try {
    const result = await new ProfileService(client, store).restore(input.session_id);
    return { consumed: result.restored, ...result };
  } finally {
    if (!dependencies) await client.close();
  }
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as HookInput;
  const outcome = await runSessionStart(input);
  const conflictPaths = "conflictPaths" in outcome ? outcome.conflictPaths : undefined;
  const output = conflictPaths
    ? { continue: true, systemMessage: `Skill profile recovery conflict: ${conflictPaths.join(", ")}` }
    : {
        continue: true,
        ...(outcome.consumed ? {
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext: "The armed skill profile was applied to this task; global defaults were restored.",
          },
        } : {}),
      };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  void main().catch((error) => {
    process.stdout.write(`${JSON.stringify({ continue: true, systemMessage: String(error) })}\n`);
  });
}
