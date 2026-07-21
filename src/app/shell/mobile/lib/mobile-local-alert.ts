import { isCapacitorShellRuntime } from "@freeanima/frontend/shell-sdk/alert/resolve-platform.ts";
import { createWebAlertBackend } from "@freeanima/frontend/shell-sdk/alert/web-backend.ts";
import type {
  AlertBackend,
  AlertPayload,
  AlertPermissionState,
  AlertScheduleKey,
  AlertScheduleResult,
} from "@freeanima/frontend/shell-sdk/alert/types.ts";
import type {
  ShellApi,
  ShellNativeAlertPayload,
  ShellNativeAlertPermission,
} from "@freeanima/frontend/shell-sdk/shell-api.ts";

import { waitForCapacitorBridge } from "./capacitor-ready.ts";
import {
  createLocalNotificationsApiFromNativeBridge,
  pinCapacitorNativeBridge,
  readCapacitorPlatform,
  type CapacitorLocalNotificationsApi,
} from "./capacitor-plugins.ts";

const CHANNEL_ID = "freeanima-alerts";

let channelReady = false;

/** tag → notification id（便于 cancel） */
const scheduledIdsByTag = new Map<string, number>();

type LocalNotificationsApi = CapacitorLocalNotificationsApi;

/** Capacitor 打包壳（含候选）；与 `isCapacitorShellRuntime` 同义 */
export function isCapacitorPackagedShell(): boolean {
  return isCapacitorShellRuntime();
}

export function mapLocalNotificationPermission(display: string | undefined): AlertPermissionState {
  if (display === "granted") return "granted";
  if (display === "denied") return "denied";
  if (display === "prompt") return "default";
  return "unsupported";
}

/** 将 tag 稳定映射为 LocalNotifications 所需的正整数 id。 */
export function tagToNotificationId(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 2_000_000_000) + 1;
}

async function resolveLocalNotificationsApi(): Promise<LocalNotificationsApi | null> {
  if (!isCapacitorPackagedShell()) return null;

  pinCapacitorNativeBridge();
  const immediate = createLocalNotificationsApiFromNativeBridge();
  if (immediate) return immediate;

  try {
    await waitForCapacitorBridge();
  } catch {
    return null;
  }

  pinCapacitorNativeBridge();
  return createLocalNotificationsApiFromNativeBridge();
}

async function ensureAndroidChannel(api: LocalNotificationsApi): Promise<void> {
  if (channelReady) return;
  if (readCapacitorPlatform() !== "android") {
    channelReady = true;
    return;
  }
  if (!api.createChannel) {
    channelReady = true;
    return;
  }
  try {
    await api.createChannel({
      id: CHANNEL_ID,
      name: "提醒",
      description: "番茄钟等本机瞬时提醒",
      importance: 4,
      visibility: 1,
      vibration: true,
    });
  } catch {
    /* 部分平台无 channel API */
  }
  channelReady = true;
}

export async function readLocalNotificationPermission(): Promise<AlertPermissionState> {
  const api = await resolveLocalNotificationsApi();
  if (!api) return "unsupported";
  try {
    const result = await api.checkPermissions();
    return mapLocalNotificationPermission(result.display);
  } catch {
    return "unsupported";
  }
}

export async function requestLocalNotificationPermission(): Promise<AlertPermissionState> {
  const api = await resolveLocalNotificationsApi();
  if (!api) return "unsupported";
  try {
    const current = await api.checkPermissions();
    if (current.display === "granted") return "granted";
    if (current.display === "denied") return "denied";
    const result = await api.requestPermissions();
    return mapLocalNotificationPermission(result.display);
  } catch {
    return "unsupported";
  }
}

export async function cancelLocalNotification(key: AlertScheduleKey): Promise<void> {
  const api = await resolveLocalNotificationsApi();
  if (!api?.cancel) {
    if (key.tag) scheduledIdsByTag.delete(key.tag);
    return;
  }
  const ids = new Set<number>();
  if (key.tag) {
    const mapped = scheduledIdsByTag.get(key.tag) ?? tagToNotificationId(key.tag);
    ids.add(mapped);
  }
  if (key.id) {
    const asNum = Number(key.id);
    if (Number.isFinite(asNum) && asNum > 0) ids.add(asNum);
    else if (key.id.startsWith("mobile:")) {
      const rest = key.id.slice("mobile:".length);
      const n = Number(rest);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
  }
  if (ids.size === 0) return;
  try {
    await api.cancel({ notifications: [...ids].map((id) => ({ id })) });
  } catch {
    /* 幂等：取消失败忽略 */
  }
  if (key.tag) scheduledIdsByTag.delete(key.tag);
}

export async function scheduleLocalNotification(
  payload: AlertPayload,
  at: Date,
): Promise<AlertScheduleResult> {
  const api = await resolveLocalNotificationsApi();
  if (!api) {
    throw new Error("当前环境不支持本机通知（Local Notifications 插件不可用）");
  }
  await ensureAndroidChannel(api);
  const tag = payload.tag ?? `freeanima:alert:${Date.now()}`;
  const id = tagToNotificationId(tag);
  await cancelLocalNotification({ tag });
  await api.schedule({
    notifications: [
      {
        id,
        title: payload.title,
        body: payload.body ?? "",
        channelId: CHANNEL_ID,
        schedule: { at },
        extra: { tag },
        ...(payload.silent === true ? { silent: true } : {}),
      },
    ],
  });
  scheduledIdsByTag.set(tag, id);
  return { id: `mobile:${id}` };
}

export async function showLocalNotification(payload: AlertPayload): Promise<void> {
  await scheduleLocalNotification(payload, new Date(Date.now() + 50));
}

function mapShellNativePermission(perm: AlertPermissionState): ShellNativeAlertPermission {
  if (perm === "granted") return "granted";
  if (perm === "denied") return "denied";
  return "unsupported";
}

/** bootstrap 注入：远程 Habitat 页通过 satelliteShell 调原生通知，不依赖 Web Notification API。 */
export function attachMobileNativeAlertToShell(shell: ShellApi): ShellApi {
  if (!shell.isNativeShell) return shell;
  return {
    ...shell,
    async requestNativeAlertPermission(): Promise<ShellNativeAlertPermission> {
      return mapShellNativePermission(await requestLocalNotificationPermission());
    },
    async showNativeAlert(payload: ShellNativeAlertPayload): Promise<void> {
      await showLocalNotification({
        title: payload.title,
        ...(payload.body !== undefined ? { body: payload.body } : {}),
        ...(payload.tag !== undefined ? { tag: payload.tag } : {}),
        ...(payload.silent === true ? { silent: true } : {}),
        ...(payload.requireInteraction === true ? { requireInteraction: true } : {}),
      });
    },
    async scheduleNativeAlert(
      payload: ShellNativeAlertPayload & { at: Date | number },
    ): Promise<{ id: string }> {
      const at = payload.at instanceof Date ? payload.at : new Date(payload.at);
      return scheduleLocalNotification(
        {
          title: payload.title,
          ...(payload.body !== undefined ? { body: payload.body } : {}),
          ...(payload.tag !== undefined ? { tag: payload.tag } : {}),
          ...(payload.silent === true ? { silent: true } : {}),
          ...(payload.requireInteraction === true ? { requireInteraction: true } : {}),
        },
        at,
      );
    },
    async cancelNativeAlert(key): Promise<void> {
      await cancelLocalNotification(key ?? {});
    },
  };
}

function shellNativeAlertAvailable(): boolean {
  const shell = window.satelliteShell;
  return Boolean(
    shell?.isNativeShell && shell.showNativeAlert && shell.requestNativeAlertPermission,
  );
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

/** Capacitor 原生壳：Local Notifications；优先 satelliteShell 原生 API。 */
export function createCapacitorLocalAlertBackend(): AlertBackend {
  const webFallback = createWebAlertBackend();

  if (shellNativeAlertAvailable()) {
    const shell = window.satelliteShell;
    const requestPerm = shell?.requestNativeAlertPermission;
    const showAlert = shell?.showNativeAlert;
    if (shell && requestPerm && showAlert) {
      const scheduleAlert = shell.scheduleNativeAlert;
      const cancelAlert = shell.cancelNativeAlert;
      const useNativeSchedule = Boolean(scheduleAlert && cancelAlert);
      return {
        platform: "mobile",
        scheduleDurability: useNativeSchedule ? "os" : "process",
        readPermission(): Promise<AlertPermissionState> {
          return requestPerm().then((result) => {
            if (result === "granted") return "granted";
            if (result === "denied") return "denied";
            return "unsupported";
          });
        },
        requestPermission(): Promise<AlertPermissionState> {
          return requestPerm().then((result) => {
            if (result === "granted") return "granted";
            if (result === "denied") return "denied";
            return "unsupported";
          });
        },
        show(payload: AlertPayload): Promise<void> {
          return showAlert(toNativePayload(payload));
        },
        async schedule(payload: AlertPayload, at: Date): Promise<AlertScheduleResult> {
          if (useNativeSchedule && scheduleAlert) {
            return scheduleAlert({ ...toNativePayload(payload), at });
          }
          return scheduleLocalNotification(payload, at);
        },
        async cancel(key: AlertScheduleKey): Promise<void> {
          if (useNativeSchedule && cancelAlert) {
            await cancelAlert(key);
            return;
          }
          await cancelLocalNotification(key);
        },
        ...(webFallback.playSound !== undefined ? { playSound: webFallback.playSound } : {}),
      };
    }
  }

  return {
    platform: "mobile",
    scheduleDurability: "os",
    readPermission: readLocalNotificationPermission,
    requestPermission: requestLocalNotificationPermission,
    show: showLocalNotification,
    schedule: scheduleLocalNotification,
    cancel: cancelLocalNotification,
    ...(webFallback.playSound !== undefined ? { playSound: webFallback.playSound } : {}),
  };
}

/** @internal 测试用 */
export function resetScheduledLocalNotificationTagsForTest(): void {
  scheduledIdsByTag.clear();
}
