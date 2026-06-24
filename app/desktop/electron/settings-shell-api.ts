import { ipcRenderer } from "electron";
import { normalizeShellClientConfig } from "@freeanima/satellite-sdk";

export type SettingsShellClientApi = {
  load(): Promise<{ hubUrl: string; remoteAuthToken: string } | null>;
  save(cfg: { hubUrl: string; remoteAuthToken: string }): Promise<void>;
  test(cfg: { hubUrl: string; remoteAuthToken: string }): Promise<void>;
};

export function createSettingsShellClientApi(): SettingsShellClientApi {
  return {
    async load() {
      return ipcRenderer.invoke("shell:get-client-config") as Promise<{
        hubUrl: string;
        remoteAuthToken: string;
      } | null>;
    },
    async save(cfg) {
      const normalized = normalizeShellClientConfig(cfg);
      await ipcRenderer.invoke("shell:save-client-config", normalized);
    },
    async test(cfg) {
      const normalized = normalizeShellClientConfig(cfg);
      await ipcRenderer.invoke("shell:test-hub-connection", normalized);
    },
  };
}
