import { contextBridge, ipcRenderer } from "electron";

const api = Object.freeze({
  call(name: string, args: Record<string, unknown>) {
    return ipcRenderer.invoke("skill-profiles:call", name, args) as Promise<Record<string, unknown>>;
  },
  getContext() {
    return ipcRenderer.invoke("skill-profiles:get-context") as Promise<{ cwd: string }>;
  },
  chooseDirectory() {
    return ipcRenderer.invoke("skill-profiles:choose-directory") as Promise<string | null>;
  },
  saveTextFile(defaultName: string, content: string) {
    return ipcRenderer.invoke(
      "skill-profiles:save-text-file",
      defaultName,
      content,
    ) as Promise<boolean>;
  },
});

contextBridge.exposeInMainWorld("skillSessionProfiles", api);
