import { getStaticTOMLValue, parseTOML } from "toml-eslint-parser";

import type { SkillConfigEntry } from "../shared/contracts.js";

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
    `path = ${JSON.stringify(entry.path)}`,
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
