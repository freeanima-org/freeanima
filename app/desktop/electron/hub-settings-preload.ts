import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("hubSettingsApi", {
  load: () =>
    ipcRenderer.invoke("shell:get-client-config") as Promise<{
      hubUrl: string;
      remoteAuthToken: string;
    } | null>,
  save: (cfg: { hubUrl: string; remoteAuthToken: string }) =>
    ipcRenderer.invoke("shell:save-client-config", cfg),
  test: (cfg: { hubUrl: string; remoteAuthToken: string }) =>
    ipcRenderer.invoke("shell:test-hub-connection", cfg),
});
