import { normalize, resolve } from "node:path";

import { AppServerClient } from "../server/app-server-client.js";
import {
  extractProjectSkillLayer,
  extractUserSkillLayer,
} from "../server/config-layer.js";
import { prepareSharedDataRoot } from "../server/data-root.js";
import { JsonStore } from "../server/json-store.js";
import { ProfileService } from "../server/profile-service.js";
import type {
  SkillConfigEntry,
  SkillMetadata,
} from "../shared/contracts.js";

interface HookInput {
  hook_event_name: "SessionStart";
  session_id: string;
  cwd: string;
  source: string;
}

interface SessionStartOutcome {
  consumed: boolean;
  restored?: boolean;
  conflictPaths?: string[];
  projectContext?: string;
}

export function renderProjectSkillPolicy(
  projectFilePath: string,
  inventory: SkillMetadata[],
  globalDefaults: SkillConfigEntry[],
  projectConfig: SkillConfigEntry[],
): string | undefined {
  if (projectConfig.length === 0) return undefined;

  const globalByPath = new Map(
    globalDefaults.map((entry) => [normalize(entry.path), entry.enabled]),
  );
  const projectByPath = new Map(
    projectConfig.map((entry) => [normalize(entry.path), entry.enabled]),
  );
  const globallyEnabled = new Set(
    inventory
      .filter((skill) => globalByPath.get(normalize(skill.path)) ?? skill.enabled)
      .map((skill) => normalize(skill.path)),
  );
  const enabled = inventory
    .filter((skill) =>
      projectByPath.get(normalize(skill.path))
      ?? globalByPath.get(normalize(skill.path))
      ?? skill.enabled)
    .sort((a, b) => a.name.localeCompare(b.name));
  const additional = enabled.filter((skill) => !globallyEnabled.has(normalize(skill.path)));
  const inventoryPaths = new Set(inventory.map((skill) => normalize(skill.path)));
  const unavailable = projectConfig
    .filter((entry) => entry.enabled && !inventoryPaths.has(normalize(entry.path)))
    .map((entry) => entry.path)
    .sort();

  const lines = [
    "<project_skill_policy>",
    `Source: ${projectFilePath}`,
    "This project-specific policy overrides the general Skills list for this session.",
    `Effective enabled skills (authoritative): ${
      enabled.length === 0
        ? "none"
        : `${enabled.map((skill) => `\`${skill.name}\``).join(", ")}`
    }.`,
    "Do not invoke or read any skill not in this exact set, even if an earlier instruction lists it.",
  ];
  if (additional.length > 0) {
    lines.push(
      "Additional enabled skill definitions:",
      ...additional.map((skill) =>
        `- ${skill.name}: ${skill.description} (file: ${skill.path})`),
      "When the request names or matches an additional enabled skill, read its SKILL.md before acting.",
    );
  }
  if (unavailable.length > 0) {
    lines.push(
      `Configured enabled paths missing from the current inventory: ${unavailable.join(", ")}.`,
    );
  }
  lines.push("</project_skill_policy>");
  return lines.join("\n");
}

export async function runSessionStart(
  input: HookInput,
  dependencies?: { client: AppServerClient; store: JsonStore },
): Promise<SessionStartOutcome> {
  if (!["startup", "resume"].includes(input.source)) return { consumed: false };
  const client = dependencies?.client ?? new AppServerClient();
  const store = dependencies?.store ?? new JsonStore(await prepareSharedDataRoot([
    process.env.PLUGIN_DATA ?? resolve(process.cwd(), ".plugin-data"),
  ]));
  try {
    const result = await new ProfileService(client, store).restore(input.session_id);
    const config = await client.readConfig(input.cwd);
    const project = extractProjectSkillLayer(config, input.cwd);
    const projectContext = project.value.length === 0
      ? undefined
      : renderProjectSkillPolicy(
          project.filePath,
          (await client.listSkills([input.cwd], true)).data[0]?.skills ?? [],
          extractUserSkillLayer(config).value,
          project.value,
        );
    return {
      consumed: result.restored,
      ...result,
      ...(projectContext === undefined ? {} : { projectContext }),
    };
  } finally {
    if (!dependencies) await client.close();
  }
}

async function main() {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(Buffer.from(chunk));
  const input = JSON.parse(Buffer.concat(chunks).toString("utf8")) as HookInput;
  const outcome = await runSessionStart(input);
  const conflictPaths = outcome.conflictPaths;
  const additionalContext = [
    outcome.consumed
      ? "The armed skill profile was applied to this task; global defaults were restored."
      : undefined,
    outcome.projectContext,
  ].filter((value): value is string => value !== undefined).join("\n\n");
  const output = {
    continue: true,
    ...(conflictPaths
      ? { systemMessage: `Skill profile recovery conflict: ${conflictPaths.join(", ")}` }
      : {}),
    ...(additionalContext.length > 0
      ? {
          hookSpecificOutput: {
            hookEventName: "SessionStart",
            additionalContext,
          },
        }
      : {}),
  };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  void main().catch((error) => {
    process.stdout.write(`${JSON.stringify({ continue: true, systemMessage: String(error) })}\n`);
  });
}
