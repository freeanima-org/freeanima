import { ipcRenderer } from "electron";
import type { ShellDebugConfig } from "@freeanima/satellite-sdk";

export type DebugSettingsApi = {
  load(): Promise<ShellDebugConfig>;
  save(cfg: ShellDebugConfig): Promise<void>;
};

export function createDebugSettingsApi(): DebugSettingsApi {
  return {
    async load() {
      return ipcRenderer.invoke("shell:get-debug-config") as Promise<ShellDebugConfig>;
    },
    async save(cfg) {
      await ipcRenderer.invoke("shell:save-debug-config", cfg);
    },
  };
}
