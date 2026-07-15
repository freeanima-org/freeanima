import { contextBridge, ipcRenderer } from "electron";
import { resolveHubRpcWsUrl } from "@freeanima/shared/hub-rpc";
import type { SapInstanceStore } from "@freeanima/shared/sap-contract";
import {
  buildShellApiFields,
  type CompanionWindowRole,
  type SatelliteShellApi,
} from "@freeanima/frontend/shell-sdk";
import { readNativeBuildMetaFromDefine } from "@freeanima/frontend/shell-sdk/native-build-meta.read";

type HubClientConfigPayload = {
  hubUrl: string;
  hubWsUrl: string;
  remoteAuthToken: string;
};

const DEFAULT_HUB_URL = "http://127.0.0.1:2658";

declare const __NATIVE_BUILD_META__: import("@freeanima/frontend/shell-sdk/build-meta").ComponentBuildMeta;

const NATIVE_BUILD = readNativeBuildMetaFromDefine(
  typeof __NATIVE_BUILD_META__ !== "undefined" ? __NATIVE_BUILD_META__ : undefined,
);

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
  const hubWsUrl = cfg?.hubWsUrl?.trim() || resolveHubRpcWsUrl(hubUrl);
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
    ...(NATIVE_BUILD ? { nativeBuild: NATIVE_BUILD } : {}),
    ...hubFields,
    windowRole,
    apiOrigin,
    createFileInstanceStore,
    openHubSettings: () => void ipcRenderer.invoke("shell:open-settings"),
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
    getCompanionVisible: () =>
      ipcRenderer.invoke("shell:get-companion-visible") as Promise<boolean>,
    setCompanionVisible: async (visible) => {
      await ipcRenderer.invoke("shell:set-companion-visible", visible);
    },
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
    showNativeAlert: (payload) => ipcRenderer.invoke("shell:alert:show", payload) as Promise<void>,
    requestNativeAlertPermission: () =>
      ipcRenderer.invoke("shell:alert:request-permission") as Promise<
        "granted" | "denied" | "unsupported"
      >,
    applyPackagedUpdate: async ({ assetUrl }) => {
      await ipcRenderer.invoke("shell:apply-packaged-update", assetUrl);
    },
  };
}

function applyHubFields(
  shell: SatelliteShellApi,
  hubFields: Pick<SatelliteShellApi, "hubUrl" | "hubWsUrl" | "remoteAuth" | "hubFetch">,
): void {
  shell.hubUrl = hubFields.hubUrl;
  shell.hubWsUrl = hubFields.hubWsUrl;
  if (hubFields.remoteAuth !== undefined) {
    shell.remoteAuth = hubFields.remoteAuth;
  } else {
    delete shell.remoteAuth;
  }
  if (hubFields.hubFetch !== undefined) {
    shell.hubFetch = hubFields.hubFetch;
  } else {
    delete shell.hubFetch;
  }
}

async function refreshHubFields(shell: SatelliteShellApi): Promise<void> {
  const next = await loadHubClientConfig();
  applyHubFields(shell, resolvePreloadHubConfig(next));
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

  shell.emitConfigChanged = async () => {
    await refreshHubFields(shell);
    await ipcRenderer.invoke("shell:emit-config-changed");
  };

  ipcRenderer.on("shell:config-changed", () => {
    void refreshHubFields(shell);
  });

  contextBridge.exposeInMainWorld("satelliteShell", shell);
  contextBridge.exposeInMainWorld("__freeanimaShellBridge", { ready: Promise.resolve() });
  contextBridge.exposeInMainWorld("freeanimaScopedSettings", {
    load(scope: import("@freeanima/frontend/shell-sdk/settings").SettingsStorageScope) {
      return ipcRenderer.invoke("shell:settings:load", scope) as Promise<unknown>;
    },
    save(
      scope: import("@freeanima/frontend/shell-sdk/settings").SettingsStorageScope,
      value: unknown,
    ) {
      return ipcRenderer.invoke("shell:settings:save", scope, value) as Promise<unknown>;
    },
    test(
      scope: import("@freeanima/frontend/shell-sdk/settings").SettingsStorageScope,
      value: unknown,
    ) {
      return ipcRenderer.invoke("shell:settings:test", scope, value) as Promise<unknown>;
    },
  });
}

bootstrapPreload();

export type DesktopShellPreloadModule = true;
