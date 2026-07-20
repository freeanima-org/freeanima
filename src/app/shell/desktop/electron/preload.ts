import { contextBridge, ipcRenderer } from "electron";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import type { SapInstanceStore } from "@freeanima/shared/sap-contract";
import {
  buildShellApiFields,
  type CompanionWindowRole,
  type SatelliteShellApi,
} from "@freeanima/frontend/shell-sdk";
import { readNativeBuildMetaFromDefine } from "@freeanima/frontend/shell-sdk/native-build-meta.read";

type HabitatClientConfigPayload = {
  habitatUrl: string;
  habitatWsUrl: string;
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

function readArgvHubConfig(): { habitatUrl: string; remoteAuthToken: string } {
  const habitatUrlArg = process.argv.find((v) => v.startsWith("--hub-url="));
  const rawUrl = habitatUrlArg?.slice("--hub-url=".length)?.trim() ?? "";
  const remoteAuthTokenArg = process.argv.find((v) => v.startsWith("--remote-auth-token="));
  const remoteAuthToken = remoteAuthTokenArg?.slice("--remote-auth-token=".length) ?? "";
  return {
    habitatUrl: rawUrl || DEFAULT_HUB_URL,
    remoteAuthToken,
  };
}

/** Electron 仅过桥可序列化字段；勿暴露 habitatFetch（Response 经 contextBridge 会丢方法）。 */
type PreloadHabitatFields = Pick<SatelliteShellApi, "habitatUrl" | "habitatWsUrl" | "remoteAuth">;

function resolvePreloadHabitatConfig(cfg: HabitatClientConfigPayload | null): PreloadHabitatFields {
  const fallback = readArgvHubConfig();
  const habitatUrl = (cfg?.habitatUrl?.trim() || fallback.habitatUrl || DEFAULT_HUB_URL).replace(
    /\/$/,
    "",
  );
  const habitatWsUrl = cfg?.habitatWsUrl?.trim() || resolveHabitatRpcWsUrl(habitatUrl);
  const remoteAuthToken = cfg?.remoteAuthToken?.trim() || fallback.remoteAuthToken || "";
  const fields = buildShellApiFields(habitatUrl, habitatWsUrl, remoteAuthToken);
  return {
    habitatUrl: fields.habitatUrl,
    habitatWsUrl: fields.habitatWsUrl,
    ...(fields.remoteAuth !== undefined ? { remoteAuth: fields.remoteAuth } : {}),
  };
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

function createSatelliteShell(hubFields: PreloadHabitatFields): SatelliteShellApi {
  return {
    isElectron: true,
    primaryInput: "pointer",
    ...(NATIVE_BUILD ? { nativeBuild: NATIVE_BUILD } : {}),
    ...hubFields,
    windowRole,
    apiOrigin,
    createFileInstanceStore,
    openHabitatSettings: () => void ipcRenderer.invoke("shell:open-settings"),
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
    scheduleNativeAlert: async (payload) => {
      const atMs = payload.at instanceof Date ? payload.at.getTime() : Number(payload.at);
      return ipcRenderer.invoke("shell:alert:schedule", {
        title: payload.title,
        ...(payload.body !== undefined ? { body: payload.body } : {}),
        ...(payload.tag !== undefined ? { tag: payload.tag } : {}),
        ...(payload.silent === true ? { silent: true } : {}),
        ...(payload.requireInteraction === true ? { requireInteraction: true } : {}),
        atMs,
      }) as Promise<{ id: string }>;
    },
    cancelNativeAlert: async (key) => {
      await ipcRenderer.invoke("shell:alert:cancel", key ?? {});
    },
    applyPackagedUpdate: async ({ assetUrl, expectedSize }) => {
      await ipcRenderer.invoke("shell:apply-packaged-update", {
        assetUrl,
        ...(expectedSize != null ? { expectedSize } : {}),
      });
    },
    onPackagedUpdateProgress: (handler) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: {
          received: number;
          total: number | null;
          phase?: "downloading" | "installing";
        },
      ) => {
        handler(payload);
      };
      ipcRenderer.on("shell:packaged-update-progress", listener);
      return () => {
        ipcRenderer.removeListener("shell:packaged-update-progress", listener);
      };
    },
  };
}

function applyHabitatFields(shell: SatelliteShellApi, hubFields: PreloadHabitatFields): void {
  shell.habitatUrl = hubFields.habitatUrl;
  shell.habitatWsUrl = hubFields.habitatWsUrl;
  if (hubFields.remoteAuth !== undefined) {
    shell.remoteAuth = hubFields.remoteAuth;
  } else {
    delete shell.remoteAuth;
  }
  // 勿经 contextBridge 暴露 habitatFetch：返回的 Response 会被克隆并丢失 .text()
  delete shell.habitatFetch;
}

async function refreshHabitatFields(shell: SatelliteShellApi): Promise<void> {
  const next = await loadHabitatClientConfig();
  applyHabitatFields(shell, resolvePreloadHabitatConfig(next));
}

async function loadHabitatClientConfig(): Promise<HabitatClientConfigPayload | null> {
  return ipcRenderer.invoke(
    "shell:get-client-config",
  ) as Promise<HabitatClientConfigPayload | null>;
}

function loadHabitatClientConfigSync(): HabitatClientConfigPayload | null {
  return ipcRenderer.sendSync("shell:get-client-config-sync") as HabitatClientConfigPayload | null;
}

function bootstrapPreload(): void {
  const cfg = loadHabitatClientConfigSync();
  const shell = createSatelliteShell(resolvePreloadHabitatConfig(cfg));

  shell.emitConfigChanged = async () => {
    await refreshHabitatFields(shell);
    await ipcRenderer.invoke("shell:emit-config-changed");
  };

  ipcRenderer.on("shell:config-changed", () => {
    void refreshHabitatFields(shell);
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
