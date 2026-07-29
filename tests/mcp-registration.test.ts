import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, it } from "vitest";

interface McpConfig {
  mcpServers: Record<string, {
    command: string;
    args?: string[];
    cwd?: string;
  }>;
}

const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

it("registers the panel tool through the packaged MCP configuration", async () => {
  const config = JSON.parse(
    await readFile(resolve(pluginRoot, ".mcp.json"), "utf8"),
  ) as McpConfig;
  const entry = config.mcpServers["skill-session-profiles"];
  const client = new Client({ name: "registration-test", version: "1.0.0" });
  const transport = new StdioClientTransport({
    command: entry.command,
    args: entry.args,
    cwd: resolve(pluginRoot, entry.cwd ?? "."),
    stderr: "pipe",
  });

  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map(({ name }) => name)).toContain(
      "open_skill_session_profiles",
    );
    expect(tools.tools.map(({ name }) => name)).toContain(
      "apply_skill_configuration",
    );
  } finally {
    await client.close();
  }
});
