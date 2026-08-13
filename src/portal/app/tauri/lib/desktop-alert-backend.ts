import { createWebAlertBackend } from "@freeanima/client/portal-sdk/alert/web-backend.ts";
import type {
  AlertBackend,
  AlertPayload,
  AlertPermissionState,
  AlertScheduleKey,
  AlertScheduleResult,
} from "@freeanima/client/portal-sdk/alert/types.ts";
import type { ShellNativeAlertPermission } from "@freeanima/client/portal-sdk/shell-api.ts";

export type NativeAlertPermissionMode = "lenient" | "strict";

function shellNativeAlertAvailable(): boolean {
  const shell = window.portalShell;
  return Boolean(shell?.showNativeAlert && shell.requestNativeAlertPermission);
}

function shellScheduleAvailable(): boolean {
  const shell = window.portalShell;
  return Boolean(shell?.scheduleNativeAlert && shell.cancelNativeAlert);
}

function mapShellPermission(result: ShellNativeAlertPermission): AlertPermissionState {
  if (result === "granted") return "granted";
  if (result === "denied") return "denied";
  if (result === "default") return "default";
  return "unsupported";
}

function toNativePayload(payload: AlertPayload) {
  return {
    title: payload.title,
    ...(payload.body !== undefined ? { body: payload.body } : {}),
    ...(payload.tag !== undefined ? { tag: payload.tag } : {}),
    ...(payload.silent === true ? { silent: true } : {}),
    ...(payload.requireInteraction === true ? { requireInteraction: true } : {}),
  };
}

/**
 * Tauri 桌面壳：优先 Rust 原生通知。
 * - lenient：权限 IPC 失败视为 granted；原生 show 失败回退 Web（HMR / 旧二进制友好）
 * - strict：权限失败按结果处理（移动端）
 */
export function createDesktopAlertBackend(opts?: {
  permissionMode?: NativeAlertPermissionMode;
}): AlertBackend {
  const permissionMode = opts?.permissionMode ?? "lenient";
  const webFallback = createWebAlertBackend();

  if (!shellNativeAlertAvailable()) {
    return {
      ...webFallback,
      platform: "desktop",
    };
  }

  const shell = window.portalShell;
  const requestPermFn = shell?.requestNativeAlertPermission;
  const readPermFn = shell?.readNativeAlertPermission;
  const showAlertFn = shell?.showNativeAlert;
  if (!shell || !requestPermFn || !showAlertFn) {
    return {
      ...webFallback,
      platform: "desktop",
    };
  }

  // 早退后收窄到确定存在的函数，供闭包使用（避免 TS 在嵌套函数中放宽为 optional）
  const requestNativeAlertPermission = requestPermFn;
  const showNativeAlert = showAlertFn;
  const readNativeAlertPermission = readPermFn;

  const scheduleAlert = shell.scheduleNativeAlert;
  const cancelAlert = shell.cancelNativeAlert;
  const useNativeSchedule = shellScheduleAvailable() && scheduleAlert && cancelAlert;

  async function readNativePermission(): Promise<AlertPermissionState> {
    if (!readNativeAlertPermission) return webFallback.readPermission();
    try {
      return mapShellPermission(await readNativeAlertPermission());
    } catch {
      return permissionMode === "lenient" ? "granted" : "unsupported";
    }
  }

  async function requestNativePermission(): Promise<AlertPermissionState> {
    try {
      return mapShellPermission(await requestNativeAlertPermission());
    } catch {
      return permissionMode === "lenient" ? "granted" : "unsupported";
    }
  }

  return {
    platform: "desktop",
    scheduleDurability: useNativeSchedule ? "process" : webFallback.scheduleDurability,
    async readPermission(): Promise<AlertPermissionState> {
      return readNativePermission();
    },
    async requestPermission(): Promise<AlertPermissionState> {
      return requestNativePermission();
    },
    async show(payload: AlertPayload): Promise<void> {
      let perm = await readNativePermission();
      if (perm === "default") {
        perm = await requestNativePermission();
      }
      if (perm === "denied" || perm === "unsupported") {
        return;
      }
      try {
        await showNativeAlert(toNativePayload(payload));
      } catch {
        if (permissionMode === "lenient") {
          await webFallback.show(payload);
        }
      }
    },
    async schedule(payload: AlertPayload, at: Date): Promise<AlertScheduleResult> {
      if (useNativeSchedule && scheduleAlert) {
        return scheduleAlert({ ...toNativePayload(payload), at });
      }
      return webFallback.schedule(payload, at);
    },
    async cancel(key: AlertScheduleKey): Promise<void> {
      if (useNativeSchedule && cancelAlert) {
        await cancelAlert(key);
        return;
      }
      await webFallback.cancel(key);
    },
    ...(webFallback.playSound !== undefined
      ? {
          playSound: () => {
            webFallback.playSound?.();
          },
        }
      : {}),
  };
}
