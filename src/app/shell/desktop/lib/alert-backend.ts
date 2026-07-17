import { createWebAlertBackend } from "@freeanima/frontend/shell-sdk/alert/web-backend.ts";
import type {
  AlertBackend,
  AlertPayload,
  AlertPermissionState,
  AlertScheduleKey,
  AlertScheduleResult,
} from "@freeanima/frontend/shell-sdk/alert/types.ts";

function shellNativeAlertAvailable(): boolean {
  const shell = window.satelliteShell;
  return Boolean(shell?.isElectron && shell.showNativeAlert && shell.requestNativeAlertPermission);
}

function shellScheduleAvailable(): boolean {
  const shell = window.satelliteShell;
  return Boolean(shell?.scheduleNativeAlert && shell.cancelNativeAlert);
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

/** Desktop 壳：优先 Electron 主进程 OS 原生通知，开发回退 Web Notification API。 */
export function createDesktopAlertBackend(): AlertBackend {
  const webFallback = createWebAlertBackend();

  if (!shellNativeAlertAvailable()) {
    return {
      ...webFallback,
      platform: "desktop",
    };
  }

  const shell = window.satelliteShell;
  const requestPerm = shell?.requestNativeAlertPermission;
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
    readPermission(): Promise<AlertPermissionState> {
      if (shellNativeAlertAvailable()) {
        return requestPerm().then((result) => {
          if (result === "granted") return "granted";
          if (result === "denied") return "denied";
          return "unsupported";
        });
      }
      return webFallback.readPermission();
    },
    async requestPermission(): Promise<AlertPermissionState> {
      const result = await requestPerm();
      if (result === "granted") return "granted";
      if (result === "denied") return "denied";
      return "unsupported";
    },
    async show(payload: AlertPayload): Promise<void> {
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
