import { contextBridge, ipcRenderer } from "electron";
import { resolveHubWsUrl, type SapInstanceStore } from "@freeanima/sap-contract";
import {
  buildShellApiFields,
  type CompanionWindowRole,
  type SatelliteShellApi,
} from "@freeanima/shell-sdk";

type HubClientConfigPayload = {
  hubUrl: string;
  hubWsUrl: string;
  remoteAuthToken: string;
};

const DEFAULT_HUB_URL = "http://127.0.0.1:2658";

const apiOriginArg = process.argv.find((v) => v.startsWith("--companion-api-origin="));
const windowRoleArg = process.argv.find((v) => v.startsWith("--companion-window="));
const apiOrigin = apiOriginArg?.slice("--companion-api-origin=".length) ?? null;
const windowRoleRaw = windowRoleArg?.slice("--companion-window=".length);
const windowRole: CompanionWindowRole | null =
  windowRoleRaw === "settings" ? "settings" : windowRoleRaw === "overlay" ? "overlay" : null;

function readArgvHubConfig(): { hubUrl: string; remoteAuthToken: string } {
  const hubUrlArg = process.argv.find((v) => v.startsWith("--hub-url="));
  const rawUrl = hubUrlArg?.slice("--hub-url=".length)?.trim() ?? "";
  const remoteAuthTokenArg = process.argv.find((v) => v.startsWith("--remote-auth-token="));
  const remoteAuthToken = remoteAuthTokenArg?.slice("--remote-auth-token=".length) ?? "";
  return {
    hubUrl: rawUrl || DEFAULT_HUB_URL,
    remoteAuthToken,
  };
}

function resolvePreloadHubConfig(
  cfg: HubClientConfigPayload | null,
): Pick<SatelliteShellApi, "hubUrl" | "hubWsUrl" | "remoteAuth" | "hubFetch"> {
  const fallback = readArgvHubConfig();
  const hubUrl = (cfg?.hubUrl?.trim() || fallback.hubUrl || DEFAULT_HUB_URL).replace(/\/$/, "");
  const hubWsUrl = cfg?.hubWsUrl?.trim() || resolveHubWsUrl(hubUrl);
  const remoteAuthToken = cfg?.remoteAuthToken?.trim() || fallback.remoteAuthToken || "";
  return buildShellApiFields(hubUrl, hubWsUrl, remoteAuthToken);
}

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

function createSatelliteShell(
  hubFields: Pick<SatelliteShellApi, "hubUrl" | "hubWsUrl" | "remoteAuth" | "hubFetch">,
): SatelliteShellApi {
  return {
    isElectron: true,
    ...hubFields,
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
}

function applyHubFields(
  shell: SatelliteShellApi,
  hubFields: Pick<SatelliteShellApi, "hubUrl" | "hubWsUrl" | "remoteAuth" | "hubFetch">,
): void {
  shell.hubUrl = hubFields.hubUrl;
  shell.hubWsUrl = hubFields.hubWsUrl;
  shell.remoteAuth = hubFields.remoteAuth;
  shell.hubFetch = hubFields.hubFetch;
}

async function loadHubClientConfig(): Promise<HubClientConfigPayload | null> {
  return ipcRenderer.invoke("shell:get-client-config") as Promise<HubClientConfigPayload | null>;
}

function loadHubClientConfigSync(): HubClientConfigPayload | null {
  return ipcRenderer.sendSync("shell:get-client-config-sync") as HubClientConfigPayload | null;
}

function bootstrapPreload(): void {
  const cfg = loadHubClientConfigSync();
  const shell = createSatelliteShell(resolvePreloadHubConfig(cfg));

  ipcRenderer.on("shell:config-changed", () => {
    void loadHubClientConfig().then((next) => {
      applyHubFields(shell, resolvePreloadHubConfig(next));
    });
  });

  contextBridge.exposeInMainWorld("satelliteShell", shell);
  contextBridge.exposeInMainWorld("__freeanimaShellBridge", { ready: Promise.resolve() });
  contextBridge.exposeInMainWorld("freeanimaScopedSettings", {
    load(scope: import("@freeanima/shell-sdk/settings").SettingsStorageScope) {
      return ipcRenderer.invoke("shell:settings:load", scope) as Promise<unknown>;
    },
    save(scope: import("@freeanima/shell-sdk/settings").SettingsStorageScope, value: unknown) {
      return ipcRenderer.invoke("shell:settings:save", scope, value) as Promise<unknown>;
    },
    test(scope: import("@freeanima/shell-sdk/settings").SettingsStorageScope, value: unknown) {
      return ipcRenderer.invoke("shell:settings:test", scope, value) as Promise<unknown>;
    },
  });
}

bootstrapPreload();

export type DesktopShellPreloadModule = true;
