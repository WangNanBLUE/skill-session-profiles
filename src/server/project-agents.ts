import { join } from "node:path";
import { z } from "zod";

import type { AppServerClient } from "./app-server-client.js";
import { skillConfigEntrySchema, type SkillConfigEntry } from "../shared/contracts.js";

const START = "<!-- skill-session-profiles:start -->";
const END = "<!-- skill-session-profiles:end -->";
const metadataSchema = z.object({
  version: z.literal(1),
  skills: z.array(skillConfigEntrySchema),
});

export async function readProjectSkillPolicy(
  client: AppServerClient,
  cwd: string,
): Promise<{ value: SkillConfigEntry[]; filePath: string; source: string }> {
  const entries = await client.readDirectory(cwd);
  const fileName = entries.some((entry) =>
    entry.fileName === "AGENTS.override.md" && entry.isFile)
    ? "AGENTS.override.md"
    : "AGENTS.md";
  const filePath = join(cwd, fileName);
  const source = entries.some((entry) => entry.fileName === fileName && entry.isFile)
    ? await client.readFile(filePath)
    : "";
  return { value: parseProjectSkillPolicy(source), filePath, source };
}

export function parseProjectSkillPolicy(source: string): SkillConfigEntry[] {
  const block = managedBlock(source);
  if (block === undefined) return [];
  const match = block.match(/<!-- skill-session-profiles:data (.+) -->/);
  if (match === null) throw new Error("invalid Skill Session Profiles AGENTS.md block");
  return metadataSchema.parse(JSON.parse(match[1])).skills;
}

export function replaceProjectSkillPolicy(
  source: string,
  entries: SkillConfigEntry[],
  names: Map<string, string>,
): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const existing = managedBlockRange(source);
  const withoutBlock = existing === undefined
    ? source
    : `${source.slice(0, existing.start)}${source.slice(existing.end)}`.trimEnd();
  if (entries.length === 0) return withoutBlock.length === 0 ? "" : `${withoutBlock}${newline}`;

  const enabled = entries.filter((entry) => entry.enabled);
  const disabled = entries.filter((entry) => !entry.enabled);
  const label = (entry: SkillConfigEntry) => {
    const selector = entry.path ?? entry.name;
    const name = entry.path === undefined ? entry.name : names.get(entry.path);
    return name === undefined ? `\`${selector}\`` : `\`${name}\` (\`${selector}\`)`;
  };
  const lines = [
    START,
    `<!-- skill-session-profiles:data ${JSON.stringify({ version: 1, skills: entries })} -->`,
    "## Skill Session Profiles project policy",
    "",
    "These project-specific rules override broader AGENTS.md Skill guidance when they conflict.",
    "They control Skill use by instruction only; they do not install, load, or change Codex Skill enablement.",
    ...(enabled.length === 0 ? [] : [
      "",
      "### Explicitly allowed",
      "",
      ...enabled.map((entry) => `- ${label(entry)} may be used when it is already available.`),
    ]),
    ...(disabled.length === 0 ? [] : [
      "",
      "### Disabled for this project",
      "",
      ...disabled.map((entry) => `- Do not invoke or read ${label(entry)} in this project.`),
    ]),
    END,
    "",
  ];
  const separator = withoutBlock.length === 0
    ? ""
    : withoutBlock.endsWith(`${newline}${newline}`) ? "" : withoutBlock.endsWith(newline) ? newline : `${newline}${newline}`;
  return `${withoutBlock}${separator}${lines.join(newline)}`;
}

function managedBlock(source: string): string | undefined {
  const range = managedBlockRange(source);
  return range === undefined ? undefined : source.slice(range.start, range.end);
}

function managedBlockRange(source: string): { start: number; end: number } | undefined {
  const start = source.indexOf(START);
  if (start === -1) return undefined;
  const markerEnd = source.indexOf(END, start);
  if (markerEnd === -1) throw new Error("unterminated Skill Session Profiles AGENTS.md block");
  let end = markerEnd + END.length;
  if (source.startsWith("\r\n", end)) end += 2;
  else if (source.startsWith("\n", end)) end += 1;
  return { start, end };
}
