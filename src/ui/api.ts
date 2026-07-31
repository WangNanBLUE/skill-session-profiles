export interface AppApi {
  call(name: string, args: Record<string, unknown>): Promise<Record<string, unknown>>;
  getInitialCwd?(): Promise<string>;
  chooseDirectory?(): Promise<string | null>;
  saveTextFile?(defaultName: string, content: string): Promise<boolean>;
}

export function createAppApi(): AppApi {
  const bridge = window.skillSessionProfiles;
  if (!bridge) throw new Error("Desktop bridge is unavailable");
  return {
    call: bridge.call,
    async getInitialCwd() {
      return (await bridge.getContext()).cwd;
    },
    chooseDirectory: bridge.chooseDirectory,
    saveTextFile: bridge.saveTextFile,
  };
}
