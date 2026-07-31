import { constants } from "node:fs";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { dirname, join } from "node:path";

import {
  profilesFileSchema,
  type ProfilesFile,
} from "../shared/contracts.js";

export class JsonStore {
  constructor(readonly root: string) {}

  async withLock<T>(operation: () => Promise<T>): Promise<T> {
    await mkdir(this.root, { recursive: true });
    const path = join(this.root, "operation.lock");
    let handle;
    try {
      handle = await open(path, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
      await handle.writeFile(JSON.stringify({ pid: process.pid, at: new Date().toISOString() }));
      await handle.sync();
      return await operation();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") {
        throw new Error("operation already in progress");
      }
      throw error;
    } finally {
      await handle?.close();
      if (handle !== undefined) await rm(path, { force: true });
    }
  }

  async readProfiles(): Promise<ProfilesFile> {
    const raw = await this.readOptional("profiles.json");
    return raw === undefined
      ? { schemaVersion: 1, profiles: [] }
      : profilesFileSchema.parse(JSON.parse(raw));
  }

  writeProfiles(value: ProfilesFile): Promise<void> {
    return this.atomicWrite("profiles.json", profilesFileSchema.parse(value));
  }

  async appendAudit(event: Record<string, unknown>): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const path = join(this.root, "audit.jsonl");
    const archive = join(this.root, "audit.1.jsonl");
    const line = `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`;
    let currentSize = 0;
    try {
      currentSize = (await stat(path)).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    if (currentSize > 0 && currentSize + Buffer.byteLength(line) > 256 * 1024) {
      await rm(archive, { force: true });
      await rename(path, archive);
    }
    const handle = await open(path, "a", 0o600);
    try {
      await handle.writeFile(line);
      await handle.sync();
    } finally {
      await handle.close();
    }
  }

  private async readOptional(name: string): Promise<string | undefined> {
    try {
      return await readFile(join(this.root, name), "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
      throw error;
    }
  }

  private async atomicWrite(name: string, value: unknown): Promise<void> {
    await mkdir(this.root, { recursive: true });
    const target = join(this.root, name);
    const temporary = join(this.root, `.${name}.${process.pid}.${Date.now()}.tmp`);
    const handle = await open(temporary, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    try {
      await handle.writeFile(`${JSON.stringify(value, null, 2)}\n`);
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporary, target);
    if (process.platform === "win32") return;
    const directory = await open(dirname(target), "r");
    try {
      await directory.sync();
    } finally {
      await directory.close();
    }
  }
}
