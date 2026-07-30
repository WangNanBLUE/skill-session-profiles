import { getStaticTOMLValue, parseTOML } from "toml-eslint-parser";

import type {
  ResourceToggleEntry,
  SkillConfigEntry,
} from "../shared/contracts.js";

type TomlNode = {
  type: string;
  kind?: string;
  key?: { keys: Array<{ name?: string; value?: string }> };
  range: [number, number];
  body?: TomlNode[];
};

function projectSkillTables(source: string): Array<[number, number]> {
  const ast = parseTOML(source, { tomlVersion: "1.0.0" });
  const ranges: Array<[number, number]> = [];

  const visit = (node: TomlNode) => {
    const keys = node.key?.keys.map((key) => key.name ?? key.value);
    if (
      node.type === "TOMLTable"
      && node.kind === "array"
      && keys?.length === 2
      && keys[0] === "skills"
      && keys[1] === "config"
    ) {
      const newline = source.indexOf("\n", node.range[1]);
      ranges.push([node.range[0], newline === -1 ? source.length : newline + 1]);
    }
    node.body?.forEach(visit);
  };
  (ast.body as unknown as TomlNode[]).forEach(visit);

  const value = getStaticTOMLValue(ast) as { skills?: { config?: unknown } };
  if (value.skills?.config !== undefined && ranges.length === 0) {
    throw new Error("project skills.config must use [[skills.config]] tables");
  }
  return ranges;
}

function renderSkillTables(entries: SkillConfigEntry[], newline: string): string {
  if (entries.length === 0) return "";
  return `${entries.map((entry) => [
    "[[skills.config]]",
    ...(entry.path === undefined ? [] : [`path = ${JSON.stringify(entry.path)}`]),
    ...(entry.name === undefined ? [] : [`name = ${JSON.stringify(entry.name)}`]),
    `enabled = ${String(entry.enabled)}`,
  ].join(newline)).join(`${newline}${newline}`)}${newline}`;
}

export function replaceProjectSkillConfig(
  source: string,
  entries: SkillConfigEntry[],
): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const ranges = projectSkillTables(source);
  const replacement = renderSkillTables(entries, newline);

  let result: string;
  if (ranges.length === 0) {
    const separator = source.length === 0
      ? ""
      : source.endsWith(`${newline}${newline}`)
        ? ""
        : source.endsWith(newline) ? newline : `${newline}${newline}`;
    result = `${source}${separator}${replacement}`;
  } else {
    result = source;
    for (const [start, end] of [...ranges].sort((a, b) => b[0] - a[0])) {
      result = `${result.slice(0, start)}${result.slice(end)}`;
    }
    const insertion = ranges[0][0];
    result = `${result.slice(0, insertion)}${replacement}${result.slice(insertion)}`;
  }

  parseTOML(result, { tomlVersion: "1.0.0" });
  return result;
}

export function replaceProjectResourceConfig(
  source: string,
  namespace: "plugins" | "mcp_servers",
  entries: ResourceToggleEntry[],
): string {
  const newline = source.includes("\r\n") ? "\r\n" : "\n";
  const ast = parseTOML(source, { tomlVersion: "1.0.0" });
  const desired = new Map(entries.map((entry) => [entry.id, entry.enabled]));
  const existing = new Set<string>();
  const edits: Array<{ start: number; end: number; value: string }> = [];

  const visit = (node: TomlNode) => {
    const keys = node.key?.keys.map((key) => key.name ?? key.value);
    if (
      node.type === "TOMLTable"
      && node.kind !== "array"
      && keys?.length === 2
      && keys[0] === namespace
      && typeof keys[1] === "string"
    ) {
      const id = keys[1];
      existing.add(id);
      const enabledNode = node.body?.find((child) => {
        const childKeys = child.key?.keys.map((key) => key.name ?? key.value);
        return child.type === "TOMLKeyValue"
          && childKeys?.length === 1
          && childKeys[0] === "enabled";
      });
      const enabled = desired.get(id);
      if (enabledNode) {
        const [start, end] = fullLineRange(source, enabledNode.range);
        edits.push({
          start,
          end,
          value: enabled === undefined ? "" : `enabled = ${String(enabled)}${newline}`,
        });
      } else if (enabled !== undefined) {
        const headerEnd = source.indexOf("\n", node.range[0]);
        const insertion = headerEnd === -1 ? source.length : headerEnd + 1;
        edits.push({
          start: insertion,
          end: insertion,
          value: `${headerEnd === -1 ? newline : ""}enabled = ${String(enabled)}${newline}`,
        });
      }
    }
    node.body?.forEach(visit);
  };
  (ast.body as unknown as TomlNode[]).forEach(visit);

  let result = applyTextEdits(source, edits);
  const missing = entries.filter((entry) => !existing.has(entry.id));
  if (missing.length > 0) {
    const separator = result.length === 0
      ? ""
      : result.endsWith(`${newline}${newline}`)
        ? ""
        : result.endsWith(newline) ? newline : `${newline}${newline}`;
    const rendered = missing.map((entry) => [
      `[${namespace}.${JSON.stringify(entry.id)}]`,
      `enabled = ${String(entry.enabled)}`,
    ].join(newline)).join(`${newline}${newline}`);
    result = `${result}${separator}${rendered}${newline}`;
  }

  parseTOML(result, { tomlVersion: "1.0.0" });
  return result;
}

function fullLineRange(source: string, range: [number, number]): [number, number] {
  const start = source.lastIndexOf("\n", Math.max(0, range[0] - 1)) + 1;
  const newline = source.indexOf("\n", range[1]);
  return [start, newline === -1 ? source.length : newline + 1];
}

function applyTextEdits(
  source: string,
  edits: Array<{ start: number; end: number; value: string }>,
): string {
  let result = source;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    result = `${result.slice(0, edit.start)}${edit.value}${result.slice(edit.end)}`;
  }
  return result;
}
