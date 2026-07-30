import { basename, dirname } from "node:path";

import { type AppServerClient } from "./app-server-client.js";
import {
  extractProjectResourceLayer,
  extractUserResourceLayer,
} from "./config-layer.js";
import { JsonStore } from "./json-store.js";
import { replaceProjectResourceConfig } from "./project-config.js";
import type { ResourceToggleEntry } from "../shared/contracts.js";

export type ResourceKind = "plugin" | "mcp";

const namespaceFor = (resource: ResourceKind) =>
  resource === "plugin" ? "plugins" as const : "mcp_servers" as const;

export class ResourceControlService {
  constructor(
    private readonly client: AppServerClient,
    private readonly store: JsonStore,
  ) {}

  async saveGlobal(
    cwd: string,
    resource: ResourceKind,
    value: ResourceToggleEntry[],
    allowedIds: Set<string>,
  ): Promise<ResourceToggleEntry[]> {
    validateEntries(value, allowedIds);
    return this.store.withLock(async () => {
      const namespace = namespaceFor(resource);
      const layer = extractUserResourceLayer(
        await this.client.readConfig(cwd),
        namespace,
      );
      await this.client.batchWriteResourceConfig(namespace, value, layer.version);
      if (resource === "mcp") await this.client.reloadMcpServers();
      await this.store.appendAudit({ action: `${resource}-global-config-saved`, cwd });
      return value;
    });
  }

  async saveProject(
    cwd: string,
    resource: ResourceKind,
    value: ResourceToggleEntry[],
    allowedIds: Set<string>,
  ): Promise<ResourceToggleEntry[]> {
    validateEntries(value, allowedIds);
    return this.store.withLock(async () => {
      const namespace = namespaceFor(resource);
      const layer = extractProjectResourceLayer(
        await this.client.readConfig(cwd),
        cwd,
        namespace,
      );
      const directory = dirname(layer.filePath);
      await this.client.createDirectory(directory);
      const entries = await this.client.readDirectory(directory);
      const source = entries.some((entry) =>
        entry.fileName === basename(layer.filePath) && entry.isFile)
        ? await this.client.readFile(layer.filePath)
        : "";
      const updated = replaceProjectResourceConfig(source, namespace, value);
      await this.client.writeFile(layer.filePath, updated);
      if (resource === "mcp") await this.client.reloadMcpServers();
      await this.store.appendAudit({ action: `${resource}-project-config-saved`, cwd });
      return value;
    });
  }
}

function validateEntries(
  value: ResourceToggleEntry[],
  allowedIds: Set<string>,
): void {
  if (value.some((entry) => !allowedIds.has(entry.id))) {
    throw new Error("unknown resource id");
  }
  if (new Set(value.map((entry) => entry.id)).size !== value.length) {
    throw new Error("duplicate resource id");
  }
}
