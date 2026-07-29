import { App } from "@modelcontextprotocol/ext-apps";

export interface PanelApi {
  environment?: "plugin" | "desktop";
  call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  getInitialCwd?(): Promise<string>;
  chooseDirectory?(): Promise<string | null>;
  saveTextFile?(defaultName: string, content: string): Promise<boolean>;
}

export async function createPanelApi(): Promise<PanelApi> {
  if (window.skillSessionProfiles) {
    return {
      environment: "desktop",
      call: window.skillSessionProfiles.call,
      async getInitialCwd() {
        return (await window.skillSessionProfiles?.getContext())?.cwd ?? "/";
      },
      chooseDirectory: window.skillSessionProfiles.chooseDirectory,
      saveTextFile: window.skillSessionProfiles.saveTextFile,
    };
  }
  const app = new App({ name: "skill-session-profiles", version: "0.1.0" });
  await app.connect();
  return {
    environment: "plugin",
    async call(name, args) {
      const response = await app.callServerTool({ name, arguments: args });
      return (response.structuredContent ?? {}) as Record<string, unknown>;
    },
  };
}
