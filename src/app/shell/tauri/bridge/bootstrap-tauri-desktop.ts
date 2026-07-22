/** Tauri Portal：注入 window.satelliteShell（主窗 + companion overlay） */
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import type { RemoteInstanceStore } from "@freeanima/shared/rpc-contract";
import {
  buildShellApiFields,
  testHabitatHealthConnection,
  type CompanionWindowRole,
  type PatrolScreenInfo,
  type ScreenPoint,
  type ShellApi,
} from "@freeanima/frontend/shell-sdk";
import type { ComponentBuildMeta } from "@freeanima/frontend/shell-sdk/build-meta";
import { loadTauriNativeBuildMetaFromAssets } from "@freeanima/frontend/shell-sdk/native-build-meta.read";
import { NATIVE_BUILD_META_CHANGED_EVENT } from "@freeanima/frontend/shell-sdk/native-build-meta.resolve";
import type { ShellNativeAlertPayload } from "@freeanima/frontend/shell-sdk/shell-api.ts";
import {
  applyHabitatConfigToShell,
  notifyShellConfigChanged,
} from "../lib/apply-habitat-to-shell.ts";

type HabitatCfg = { habitatUrl: string; remoteAuthToken: string };

type RemoteToolsStatusWire = {
  instance_id: string;
  remote_tools_connected: boolean;
};

const DEFAULT_HUB = "http://127.0.0.1:2658";

function detectWindowRole(): CompanionWindowRole | null {
  const q = new URLSearchParams(window.location.search);
  const view = q.get("view");
  if (view === "overlay") return "overlay";
  if (view === "settings") return "settings";
  return null;
}

function createFileInstanceStore(appId: string): RemoteInstanceStore {
  return {
    load: () => invoke<string | null>("instance_load", { appId }),
    save: (instanceId) => invoke("instance_save", { appId, instanceId }),
  };
}

function normalizeHabitatUrl(raw: string): string {
  return String(raw ?? "")
    .trim()
    .replace(/\/$/, "");
}

async function loadTauriNativeBuildMeta(): Promise<ComponentBuildMeta | undefined> {
  return loadTauriNativeBuildMetaFromAssets();
}

export async function bootstrapTauriBridge(): Promise<void> {
  let cfg: HabitatCfg;
  try {
    cfg = await invoke<HabitatCfg>("get_habitat_config");
  } catch {
    cfg = { habitatUrl: DEFAULT_HUB, remoteAuthToken: "" };
  }
  const habitatUrl = (cfg.habitatUrl || DEFAULT_HUB).replace(/\/$/, "");
  const habitatWsUrl = resolveHabitatRpcWsUrl(habitatUrl);
  const fields = buildShellApiFields(habitatUrl, habitatWsUrl, cfg.remoteAuthToken ?? "");
  const windowRole = detectWindowRole();
  const nativeBuild = await loadTauriNativeBuildMeta();

  const shell: ShellApi = {
    isElectron: false,
    isTauri: true,
    isNativeShell: true,
    primaryInput: "pointer",
    habitatUrl: fields.habitatUrl,
    habitatWsUrl: fields.habitatWsUrl,
    ...(fields.remoteAuth !== undefined ? { remoteAuth: fields.remoteAuth } : {}),
    ...(nativeBuild ? { nativeBuild } : {}),
    windowRole,
    apiOrigin: null,
    createFileInstanceStore,
    openHabitatSettings: () => void invoke("open_settings"),
    openSettings: () => invoke("open_settings"),
    setClickThrough: (ignore) => invoke("set_click_through", { ignore }),
    setPointerActive: (active) => invoke("set_pointer_active", { active }),
    moveWindow: (x, y) => invoke("move_companion_window", { x, y }),
    getPatrolScreen: () => invoke<PatrolScreenInfo>("get_patrol_screen"),
    getWindowPosition: () => invoke<ScreenPoint>("get_companion_position"),
    startWindowDrag: () => invoke("start_companion_drag"),
    getCompanionVisible: () => invoke<boolean>("get_companion_visible"),
    setCompanionVisible: (visible) => invoke("set_companion_visible", { visible }),
    listenConfigChanged: (handler) => {
      let unlisten: (() => void) | undefined;
      void listen("shell:config-changed", () => {
        notifyShellConfigChanged();
        handler();
      }).then((u) => {
        unlisten = u;
      });
      return () => unlisten?.();
    },
    listenCursorPosition: (handler) => {
      const id = window.setInterval(() => {
        void invoke<ScreenPoint>("get_cursor_position")
          .then(handler)
          .catch(() => undefined);
      }, 50);
      return () => window.clearInterval(id);
    },
    reportCompanionRemoteToolsStatus: (status) => invoke("report_remote_tools_status", { status }),
    getCompanionRemoteToolsStatus: async () => {
      const raw = await invoke<Record<string, unknown>>("get_remote_tools_status");
      return {
        instance_id: String(raw.instance_id ?? raw.instanceId ?? ""),
        remote_tools_connected: Boolean(
          raw.remote_tools_connected ?? raw.remoteToolsConnected ?? false,
        ),
      } satisfies RemoteToolsStatusWire;
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
        let launchAtLogin = false;
        try {
          launchAtLogin = await invoke<boolean>("plugin:autostart|is_enabled");
        } catch {
          launchAtLogin = false;
        }
        return {
          habitatUrl: c.habitatUrl,
          remoteAuthToken: c.remoteAuthToken,
          launchAtLogin,
        };
      }
      if (scope.kind === "kv" && scope.id === "companion-shell") {
        const visible = await invoke<boolean>("get_companion_visible");
        return { visible };
      }
      return null;
    },
    save: async (scope, value) => {
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as {
          habitatUrl: string;
          remoteAuthToken: string;
          launchAtLogin?: boolean;
        };
        await invoke("set_habitat_config", {
          habitatUrl: raw.habitatUrl,
          remoteAuthToken: raw.remoteAuthToken,
        });
        // 必须同步内存 token，否则 needsHabitatSetup 仍为 true，保存后无法离开设置页。
        applyHabitatConfigToShell(shell, raw.habitatUrl, raw.remoteAuthToken);
        notifyShellConfigChanged();
        if (typeof raw.launchAtLogin === "boolean") {
          try {
            if (raw.launchAtLogin) {
              await invoke("plugin:autostart|enable");
            } else {
              await invoke("plugin:autostart|disable");
            }
          } catch (e) {
            throw new Error(`开机自启动设置失败：${e instanceof Error ? e.message : String(e)}`, {
              cause: e,
            });
          }
        }
        return;
      }
      if (scope.kind === "kv" && scope.id === "companion-shell") {
        const visible = (value as { visible?: boolean }).visible !== false;
        await invoke("set_companion_visible", { visible });
      }
    },
    test: async (scope, value) => {
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as { habitatUrl: string; remoteAuthToken: string };
        const url = normalizeHabitatUrl(raw.habitatUrl);
        const token = String(raw.remoteAuthToken ?? "").trim();
        if (!url) throw new Error("栖息地地址不能为空");
        await testHabitatHealthConnection(url, token || undefined);
        return true;
      }
      throw new Error(`scope ${scope.id} 不支持 test`);
    },
  };
}
