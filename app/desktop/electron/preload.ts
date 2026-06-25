import { contextBridge, ipcRenderer } from "electron";
import { resolveHubWsUrl, type SapInstanceStore } from "@freeanima/sap-contract";
import {
  createBearerFetch,
  type CompanionWindowRole,
  type SatelliteShellApi,
} from "@freeanima/satellite-sdk";

import { createSettingsShellClientApi } from "./settings-shell-api.ts";
import { createDebugSettingsApi } from "./debug-settings-api.ts";

const hubUrlArg = process.argv.find((v) => v.startsWith("--hub-url="));
const hubUrl = hubUrlArg?.slice("--hub-url=".length) ?? "http://127.0.0.1:2658";
const hubWsUrl = resolveHubWsUrl(hubUrl);

const remoteAuthTokenArg = process.argv.find((v) => v.startsWith("--remote-auth-token="));
const remoteAuthToken = remoteAuthTokenArg?.slice("--remote-auth-token=".length) ?? "";
const remoteAuth = remoteAuthToken ? { token: remoteAuthToken } : undefined;
const hubFetch = remoteAuthToken ? createBearerFetch(remoteAuthToken, hubUrl) : undefined;

const apiOriginArg = process.argv.find((v) => v.startsWith("--companion-api-origin="));
const windowRoleArg = process.argv.find((v) => v.startsWith("--companion-window="));
const apiOrigin = apiOriginArg?.slice("--companion-api-origin=".length) ?? null;
const windowRoleRaw = windowRoleArg?.slice("--companion-window=".length);
const windowRole: CompanionWindowRole | null =
  windowRoleRaw === "settings" ? "settings" : windowRoleRaw === "overlay" ? "overlay" : null;

function createFileInstanceStore(appId: string): SapInstanceStore {
  return {
    load(): Promise<string | null> {
      return ipcRenderer.invoke("shell:instance-load", appId) as Promise<string | null>;
    },
    save(instanceId: string): Promise<void> {
      return ipcRenderer.invoke("shell:instance-save", appId, instanceId) as Promise<void>;
    },
  };
}

const shell: SatelliteShellApi = {
  isElectron: true,
  hubUrl,
  hubWsUrl,
  remoteAuth,
  hubFetch,
  windowRole,
  apiOrigin,
  createFileInstanceStore,
  openHubSettings: () => ipcRenderer.invoke("shell:open-settings"),
  setClickThrough: (ignore) => ipcRenderer.invoke("shell:set-clickthrough", ignore),
  setPointerActive: (active) => ipcRenderer.invoke("shell:set-pointer-active", active),
  moveWindow: (x, y) => ipcRenderer.invoke("shell:move-window", x, y),
  getPatrolScreen: () => ipcRenderer.invoke("shell:get-patrol-screen"),
  getWindowPosition: () => ipcRenderer.invoke("shell:get-window-position"),
  listenCursorPosition: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, pos: { x: number; y: number }) => {
      handler(pos);
    };
    ipcRenderer.on("shell:cursor-position", listener);
    return () => {
      ipcRenderer.removeListener("shell:cursor-position", listener);
    };
  },
  startWindowDrag: () => ipcRenderer.invoke("shell:start-drag"),
  openSettings: () => ipcRenderer.invoke("shell:open-settings"),
  emitConfigChanged: () => ipcRenderer.invoke("shell:emit-config-changed"),
  listenConfigChanged: (handler) => {
    const listener = () => handler();
    ipcRenderer.on("shell:config-changed", listener);
    return () => {
      ipcRenderer.removeListener("shell:config-changed", listener);
    };
  },
  listenServerError: (handler) => {
    const listener = (_event: Electron.IpcRendererEvent, message: string) => handler(message);
    ipcRenderer.on("shell:server-error", listener);
    return () => {
      ipcRenderer.removeListener("shell:server-error", listener);
    };
  },
};

contextBridge.exposeInMainWorld("satelliteShell", shell);
contextBridge.exposeInMainWorld("settingsShellClientApi", createSettingsShellClientApi());
contextBridge.exposeInMainWorld("debugSettingsApi", createDebugSettingsApi());

export type DesktopShellPreloadModule = true;
