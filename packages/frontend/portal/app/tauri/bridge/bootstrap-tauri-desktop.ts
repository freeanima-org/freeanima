/** Tauri Portal：注入 window.portalShell（主窗 + companion overlay） */
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { resolveHabitatRpcWsUrl } from "@freeanima/shared/habitat-rpc";
import type { RemoteInstanceStore } from "@freeanima/shared/rpc-contract";
import {
  buildShellApiFields,
  testHabitatHealthConnection,
  type CompanionWindowRole,
  type PatrolScreenInfo,
  type ScreenPoint,
  type ShellApi,
} from "@freeanima/client/portal-sdk";
import type { ComponentBuildMeta } from "@freeanima/client/portal-sdk/build-meta";
import { loadTauriNativeBuildMetaFromAssets } from "@freeanima/client/portal-sdk/native-build-meta.read";
import { NATIVE_BUILD_META_CHANGED_EVENT } from "@freeanima/client/portal-sdk/native-build-meta.resolve";
import type {
  ShellNativeAlertPayload,
  ShellNativeAlertPermission,
} from "@freeanima/client/portal-sdk/shell-api.ts";
import {
  applyHabitatConfigToShell,
  notifyShellConfigChanged,
} from "../lib/apply-habitat-to-shell.ts";
import { coerceString } from "@freeanima/shared/coerce-string";
import {
  codingPickDirectoryBridge,
  codingRunCommandBridge,
  createCodingWorkspaceFsBridge,
  desktopSaveBlobBridge,
} from "../lib/coding-shell-fs.ts";

type HabitatCfg = { habitatUrl: string; remoteAuthToken: string };

type RemoteToolsStatusPayload = {
  instance_id: string;
  remote_tools_connected: boolean;
};

const DEFAULT_HABITAT_URL = "http://127.0.0.1:2658";

function isWindowsDesktop(): boolean {
  if (typeof navigator === "undefined") return false;
  return /Win/i.test(navigator.platform) || /Windows/i.test(navigator.userAgent);
}

/** Windows 上 disable 时注册表 Run 值本就不存在会报 os error 2，视为已关闭。 */
function isAutostartAlreadyDisabledError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return /os error 2|找不到指定的文件|not found/i.test(msg);
}

async function syncLaunchAtLogin(desired: boolean): Promise<void> {
  let current = false;
  try {
    current = await invoke<boolean>("plugin:autostart|is_enabled");
  } catch {
    current = false;
  }
  if (desired === current) return;
  try {
    if (desired) {
      await invoke("plugin:autostart|enable");
    } else {
      await invoke("plugin:autostart|disable");
    }
  } catch (e) {
    if (!desired && isAutostartAlreadyDisabledError(e)) return;
    throw new Error(`开机自启动设置失败：${e instanceof Error ? e.message : String(e)}`, {
      cause: e,
    });
  }
}

function detectWindowRole(): CompanionWindowRole | null {
  const q = new URLSearchParams(window.location.search);
  const view = q.get("view");
  if (view === "overlay") return "overlay";
  if (view === "settings") return "settings";
  // 打包态 WebviewUrl::App("companion/index.html") 无 query；靠路径识别 overlay
  const path = window.location.pathname.replace(/\\/g, "/");
  if (/(^|\/)companion\/index\.html$/i.test(path) || /(^|\/)companion\/?$/i.test(path)) {
    return "overlay";
  }
  return null;
}

function createFileInstanceStore(appId: string): RemoteInstanceStore {
  return {
    load: () => invoke<string | null>("instance_load", { appId }),
    save: (instanceId) => invoke("instance_save", { appId, instanceId }),
  };
}

function normalizeHabitatUrl(raw: string): string {
  return (raw ?? "").trim().replace(/\/$/, "");
}

async function loadTauriNativeBuildMeta(): Promise<ComponentBuildMeta | undefined> {
  return loadTauriNativeBuildMetaFromAssets();
}

export async function bootstrapTauriBridge(): Promise<void> {
  let cfg: HabitatCfg;
  try {
    cfg = await invoke<HabitatCfg>("get_habitat_config");
  } catch {
    cfg = { habitatUrl: DEFAULT_HABITAT_URL, remoteAuthToken: "" };
  }
  const habitatUrl = (cfg.habitatUrl || DEFAULT_HABITAT_URL).replace(/\/$/, "");
  const habitatWsUrl = resolveHabitatRpcWsUrl(habitatUrl);
  const fields = buildShellApiFields(habitatUrl, habitatWsUrl, cfg.remoteAuthToken ?? "");
  const windowRole = detectWindowRole();
  const nativeBuild = await loadTauriNativeBuildMeta();

  const shell: ShellApi = {
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
    workspaceFs: createCodingWorkspaceFsBridge(),
    runCommand: codingRunCommandBridge,
    pickDirectory: codingPickDirectoryBridge,
    saveBlob: desktopSaveBlobBridge,
    openHabitatSettings: () => void invoke("open_settings"),
    openSettings: () => invoke("open_settings"),
    setClickThrough: (ignore) => invoke("set_click_through", { ignore }),
    setPointerActive: (active) => invoke("set_pointer_active", { active }),
    moveWindow: (x, y) => invoke("move_companion_window", { x, y }),
    getPatrolScreen: () => invoke<PatrolScreenInfo>("get_patrol_screen"),
    getWindowPosition: () => invoke<ScreenPoint>("get_companion_position"),
    startWindowDrag: () => invoke("start_companion_drag"),
    getCompanionVisible: () => invoke<boolean>("get_companion_visible"),
    setCompanionVisible: async (visible) => {
      await invoke("set_companion_visible", { visible });
      notifyShellConfigChanged();
      // Rust show 路径会 emit shell:config-changed，overlay 重拉配置
    },
    getCodingVisible: () => invoke<boolean>("get_coding_visible"),
    setCodingVisible: async (visible) => {
      await invoke("set_coding_visible", { visible });
      notifyShellConfigChanged();
    },
    enqueueCompanionBubble: async (text) => {
      await emit("companion:enqueue-bubble", { text });
    },
    listenCompanionBubble: (handler) => {
      let unlisten: (() => void) | undefined;
      void listen<{ text: string }>("companion:enqueue-bubble", (ev) => {
        const text = typeof ev.payload?.text === "string" ? ev.payload.text : "";
        if (text.trim()) handler(text);
      }).then((u) => {
        unlisten = u;
      });
      return () => unlisten?.();
    },
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
        instance_id: coerceString(raw.instance_id ?? raw.instanceId ?? ""),
        remote_tools_connected: Boolean(
          raw.remote_tools_connected ?? raw.remoteToolsConnected ?? false,
        ),
      } satisfies RemoteToolsStatusPayload;
    },
    reportCompanionModelStatus: async (status) => {
      await invoke("report_companion_model_status", {
        status: {
          model_loading: status.loading,
          error: status.error ?? null,
        },
      });
      await emit("shell:companion-model-status", {
        loading: status.loading,
        error: status.error ?? null,
      });
    },
    listenCompanionModelStatus: (handler) => {
      let unlisten: (() => void) | undefined;
      void listen<{ loading?: boolean; error?: string | null }>(
        "shell:companion-model-status",
        (ev) => {
          handler({
            loading: Boolean(ev.payload?.loading),
            error: typeof ev.payload?.error === "string" ? ev.payload.error : null,
          });
        },
      ).then((u) => {
        unlisten = u;
      });
      return () => unlisten?.();
    },
    showNativeAlert: (payload: ShellNativeAlertPayload) => invoke("show_native_alert", { payload }),
    // 桌面：tauri-plugin-notification 权限恒 Granted，无 runtime 弹窗。
    // 禁止走真实 invoke——Vite HMR 与旧 Rust 不同步时权限命令缺失会整条 Alert 挂掉。
    readNativeAlertPermission: async (): Promise<ShellNativeAlertPermission> => "granted",
    requestNativeAlertPermission: async (): Promise<ShellNativeAlertPermission> => "granted",
    setAppBadgeCount: (count: number) =>
      invoke("set_app_badge_count", { count: Math.max(0, Math.floor(count)) }),
    requestAppAttention: () => invoke("request_app_attention"),
    emitConfigChanged: async () => {
      const c = await invoke<HabitatCfg>("get_habitat_config");
      applyHabitatConfigToShell(shell, c.habitatUrl, c.remoteAuthToken ?? "");
      notifyShellConfigChanged();
      // 主窗 / 设置与 companion overlay 是不同 WebView；须 Tauri 事件跨窗通知
      // （CustomEvent / localStorage 到不了 overlay；hide 伴侣也不会 re-init）
      await emit("shell:config-changed");
    },
    ...(isWindowsDesktop()
      ? {
          applyPackagedUpdate: async (opts: { assetUrl: string; expectedSize?: number }) => {
            await invoke("apply_packaged_update", {
              assetUrl: opts.assetUrl,
              expectedSize: opts.expectedSize ?? null,
            });
          },
          onPackagedUpdateProgress: (
            handler: (progress: {
              received: number;
              total: number | null;
              phase?: "downloading" | "installing";
            }) => void,
          ): Promise<() => void> =>
            listen<{
              received: number;
              total: number | null;
              phase?: "downloading" | "installing";
            }>("shell:packaged-update-progress", (ev) => {
              handler({
                received: ev.payload.received,
                total: ev.payload.total,
                ...(ev.payload.phase != null ? { phase: ev.payload.phase } : {}),
              });
            }),
        }
      : {}),
  };

  window.portalShell = shell;
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
          await syncLaunchAtLogin(raw.launchAtLogin);
        }
        return;
      }
      if (scope.kind === "kv" && scope.id === "companion-shell") {
        const visible = (value as { visible?: boolean }).visible !== false;
        await invoke("set_companion_visible", { visible });
        notifyShellConfigChanged();
      }
    },
    test: async (scope, value) => {
      if (scope.kind === "kv" && scope.id === "habitat") {
        const raw = value as { habitatUrl: string; remoteAuthToken: string };
        const url = normalizeHabitatUrl(raw.habitatUrl);
        const token = (raw.remoteAuthToken ?? "").trim();
        if (!url) throw new Error("栖息地地址不能为空");
        await testHabitatHealthConnection(url, token || undefined);
        return true;
      }
      throw new Error(`scope ${scope.id} 不支持 test`);
    },
  };
}
