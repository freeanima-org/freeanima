/** 移动 Tauri：注入 satelliteShell + 番茄钟小组件状态同步 */
import { invoke } from "@tauri-apps/api/core";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import {
  buildShellApiFields,
  testHabitatHealthConnection,
  type RemoteInstanceStore,
  type ShellApi,
} from "@freeanima/frontend/shell-sdk";
import { loadTauriNativeBuildMetaFromAssets } from "@freeanima/frontend/shell-sdk/native-build-meta.read";
import { NATIVE_BUILD_META_CHANGED_EVENT } from "@freeanima/frontend/shell-sdk/native-build-meta.resolve";
import type { ShellNativeAlertPayload } from "@freeanima/frontend/shell-sdk/shell-api.ts";
import {
  applyHabitatConfigToShell,
  notifyShellConfigChanged,
} from "../lib/apply-habitat-to-shell.ts";

type HabitatCfg = { habitatUrl: string; remoteAuthToken: string };

const DEFAULT_HUB = "http://127.0.0.1:2658";

export type PomodoroWidgetPayload = {
  phase: string;
  remainingSec: number;
  taskTitle?: string;
};

export async function syncPomodoroWidgetState(payload: PomodoroWidgetPayload): Promise<void> {
  await invoke("set_pomodoro_widget_state", {
    payload: {
      phase: payload.phase,
      remainingSec: payload.remainingSec,
      taskTitle: payload.taskTitle ?? null,
    },
  });
}

function normalizeHabitatUrl(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\/$/, "");
}

function createFileInstanceStore(appId: string): RemoteInstanceStore {
  return {
    load: () => invoke<string | null>("instance_load", { appId }),
    save: (instanceId) => invoke("instance_save", { appId, instanceId }),
  };
}

export async function bootstrapTauriMobileBridge(): Promise<void> {
  let cfg: HabitatCfg;
  try {
    cfg = await invoke<HabitatCfg>("get_habitat_config");
  } catch {
    cfg = { habitatUrl: DEFAULT_HUB, remoteAuthToken: "" };
  }
  const habitatUrl = (cfg.habitatUrl || DEFAULT_HUB).replace(/\/$/, "");
  const fields = buildShellApiFields(
    habitatUrl,
    resolveHabitatRpcWsUrl(habitatUrl),
    cfg.remoteAuthToken ?? "",
  );
  const nativeBuild = await loadTauriNativeBuildMetaFromAssets();

  const shell: ShellApi = {
    isElectron: false,
    isTauri: true,
    isNativeShell: true,
    primaryInput: "touch",
    habitatUrl: fields.habitatUrl,
    habitatWsUrl: fields.habitatWsUrl,
    ...(fields.remoteAuth !== undefined ? { remoteAuth: fields.remoteAuth } : {}),
    ...(nativeBuild ? { nativeBuild } : {}),
    windowRole: null,
    apiOrigin: null,
    createFileInstanceStore,
    openHabitatSettings: () => {
      window.location.hash = "#/settings";
    },
    showNativeAlert: (payload: ShellNativeAlertPayload) => invoke("show_native_alert", { payload }),
    requestNativeAlertPermission: async () => "granted" as const,
    emitConfigChanged: async () => {
      const c = await invoke<HabitatCfg>("get_habitat_config");
      applyHabitatConfigToShell(shell, c.habitatUrl, c.remoteAuthToken ?? "");
      notifyShellConfigChanged();
    },
  };

  window.satelliteShell = shell;
  if (nativeBuild) {
    window.dispatchEvent(new CustomEvent(NATIVE_BUILD_META_CHANGED_EVENT));
  }

  window.freeanimaScopedSettings = {
    load: async (scope) => {
      if (scope.kind === "kv" && scope.id === "habitat") {
        const c = await invoke<HabitatCfg>("get_habitat_config");
        return {
          habitatUrl: c.habitatUrl,
          remoteAuthToken: c.remoteAuthToken,
        };
      }
      return null;
    },
    save: async (scope, value) => {
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as { habitatUrl: string; remoteAuthToken: string };
        await invoke("set_habitat_config", {
          habitatUrl: raw.habitatUrl,
          remoteAuthToken: raw.remoteAuthToken,
        });
        applyHabitatConfigToShell(shell, raw.habitatUrl, raw.remoteAuthToken);
        notifyShellConfigChanged();
      }
    },
    test: async (scope, value) => {
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as { habitatUrl: string; remoteAuthToken: string };
        const url = normalizeHabitatUrl(raw.habitatUrl);
        const token = String(raw.remoteAuthToken ?? "").trim();
        if (!url) throw new Error("栖息地地址不能为空");
        await testHabitatHealthConnection(url, token || undefined);
      }
    },
  };
}
