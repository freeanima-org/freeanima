import { createWebAlertBackend } from "@freeanima/client/portal-sdk/alert/web-backend.ts";
import type {
  AlertBackend,
  AlertPayload,
  AlertPermissionState,
  AlertScheduleKey,
  AlertScheduleResult,
} from "@freeanima/client/portal-sdk/alert/types.ts";
import type { ShellNativeAlertPermission } from "@freeanima/client/portal-sdk/shell-api.ts";

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

/** Tauri 桌面壳：优先 Rust 原生通知，开发回退 Web Notification API。 */
export function createDesktopAlertBackend(): AlertBackend {
  const webFallback = createWebAlertBackend();

  if (!shellNativeAlertAvailable()) {
    return {
      ...webFallback,
      platform: "desktop",
    };
  }

  const shell = window.portalShell;
  const requestPerm = shell?.requestNativeAlertPermission;
  const readPerm = shell?.readNativeAlertPermission;
  const showAlert = shell?.showNativeAlert;
  if (!shell || !requestPerm || !showAlert) {
    return {
      ...webFallback,
      platform: "desktop",
    };
  }

  const scheduleAlert = shell.scheduleNativeAlert;
  const cancelAlert = shell.cancelNativeAlert;
  const useNativeSchedule = shellScheduleAvailable() && scheduleAlert && cancelAlert;

  return {
    platform: "desktop",
    scheduleDurability: useNativeSchedule ? "process" : webFallback.scheduleDurability,
    async readPermission(): Promise<AlertPermissionState> {
      if (readPerm) {
        return mapShellPermission(await readPerm());
      }
      // 旧壳无 read：不主动弹窗，回退 web 探测
      return webFallback.readPermission();
    },
    async requestPermission(): Promise<AlertPermissionState> {
      return mapShellPermission(await requestPerm());
    },
    async show(payload: AlertPayload): Promise<void> {
      let perm = readPerm
        ? mapShellPermission(await readPerm())
        : await webFallback.readPermission();
      if (perm === "default") {
        perm = mapShellPermission(await requestPerm());
      }
      if (perm === "denied" || perm === "unsupported") {
        return;
      }
      await showAlert(toNativePayload(payload));
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
    ...(webFallback.playSound !== undefined ? { playSound: webFallback.playSound } : {}),
  };
}
