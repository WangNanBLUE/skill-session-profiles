import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { AppServerClient } from "../src/server/app-server-client.js";
import { JsonStore } from "../src/server/json-store.js";
import { ResourceControlService } from "../src/server/resource-control-service.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) =>
    rm(root, { recursive: true, force: true })));
});

function fakeClient() {
  return {
    readConfig: vi.fn().mockResolvedValue({
      config: {},
      origins: {},
      layers: [
        {
          name: { type: "user", profile: null },
          version: "user-v1",
          config: {},
        },
        {
          name: { type: "project", dotCodexFolder: "/repo/.codex" },
          version: "project-v1",
          config: {},
        },
      ],
    }),
    batchWriteResourceConfig: vi.fn().mockResolvedValue({
      status: "ok",
      version: "user-v2",
      filePath: "/user/config.toml",
      overriddenMetadata: null,
    }),
    reloadMcpServers: vi.fn().mockResolvedValue({}),
    createDirectory: vi.fn(),
    readDirectory: vi.fn().mockResolvedValue([
      { fileName: "config.toml", isDirectory: false, isFile: true },
    ]),
    readFile: vi.fn().mockResolvedValue([
      "[mcp_servers.docs]",
      'command = "docs-server"',
      "",
    ].join("\n")),
    writeFile: vi.fn(),
  } as unknown as AppServerClient;
}

async function setup() {
  const root = await mkdtemp(join(tmpdir(), "resource-control-"));
  roots.push(root);
  const client = fakeClient();
  return {
    client,
    service: new ResourceControlService(client, new JsonStore(root)),
  };
}

describe("resource configuration writes", () => {
  it("writes global plugin state using the base user config version", async () => {
    const { client, service } = await setup();
    const value = [{ id: "browser@openai-bundled", enabled: false }];

    await expect(service.saveGlobal(
      "/repo",
      "plugin",
      value,
      new Set(["browser@openai-bundled"]),
    )).resolves.toEqual(value);

    expect(client.batchWriteResourceConfig).toHaveBeenCalledWith(
      "plugins",
      value,
      "user-v1",
    );
    expect(client.reloadMcpServers).not.toHaveBeenCalled();
  });

  it("reloads MCP servers after a global change", async () => {
    const { client, service } = await setup();
    const value = [{ id: "docs", enabled: false }];

    await service.saveGlobal("/repo", "mcp", value, new Set(["docs"]));

    expect(client.batchWriteResourceConfig).toHaveBeenCalledWith(
      "mcp_servers",
      value,
      "user-v1",
    );
    expect(client.reloadMcpServers).toHaveBeenCalledOnce();
  });

  it("patches project MCP state without replacing server configuration", async () => {
    const { client, service } = await setup();
    const value = [{ id: "docs", enabled: false }];

    await service.saveProject("/repo", "mcp", value, new Set(["docs"]));

    expect(client.writeFile).toHaveBeenCalledWith(
      "/repo/.codex/config.toml",
      [
        "[mcp_servers.docs]",
        "enabled = false",
        'command = "docs-server"',
        "",
      ].join("\n"),
    );
    expect(client.reloadMcpServers).toHaveBeenCalledOnce();
  });

  it("rejects unknown resources before writing configuration", async () => {
    const { client, service } = await setup();

    await expect(service.saveProject(
      "/repo",
      "plugin",
      [{ id: "unknown", enabled: true }],
      new Set(["browser@openai-bundled"]),
    )).rejects.toThrow("unknown resource id");

    expect(client.writeFile).not.toHaveBeenCalled();
  });
});
