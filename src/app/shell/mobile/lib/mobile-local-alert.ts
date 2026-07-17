import { isCapacitorShellRuntime } from "@freeanima/frontend/shell-sdk/alert/resolve-platform.ts";
import { createWebAlertBackend } from "@freeanima/frontend/shell-sdk/alert/web-backend.ts";
import type {
  AlertBackend,
  AlertPayload,
  AlertPermissionState,
} from "@freeanima/frontend/shell-sdk/alert/types.ts";
import type {
  SatelliteShellApi,
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

export async function showLocalNotification(payload: AlertPayload): Promise<void> {
  const api = await resolveLocalNotificationsApi();
  if (!api) {
    throw new Error("当前环境不支持本机通知（Local Notifications 插件不可用）");
  }
  try {
    await ensureAndroidChannel(api);
    const tag = payload.tag ?? `freeanima:alert:${Date.now()}`;
    const id = tagToNotificationId(tag);
    await api.schedule({
      notifications: [
        {
          id,
          title: payload.title,
          body: payload.body ?? "",
          channelId: CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 50) },
          extra: { tag },
        },
      ],
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw e instanceof Error ? new Error(message, { cause: e }) : new Error(message);
  }
}

function mapShellNativePermission(perm: AlertPermissionState): ShellNativeAlertPermission {
  if (perm === "granted") return "granted";
  if (perm === "denied") return "denied";
  return "unsupported";
}

/** bootstrap 注入：远程 Hub 页通过 satelliteShell 调原生通知，不依赖 Web Notification API。 */
export function attachMobileNativeAlertToShell(shell: SatelliteShellApi): SatelliteShellApi {
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
  };
}

function shellNativeAlertAvailable(): boolean {
  const shell = window.satelliteShell;
  return Boolean(
    shell?.isNativeShell && shell.showNativeAlert && shell.requestNativeAlertPermission,
  );
}

/** Capacitor 原生壳：Local Notifications；优先 satelliteShell 原生 API。 */
export function createCapacitorLocalAlertBackend(): AlertBackend {
  const webFallback = createWebAlertBackend();

  if (shellNativeAlertAvailable()) {
    const shell = window.satelliteShell;
    const requestPerm = shell?.requestNativeAlertPermission;
    const showAlert = shell?.showNativeAlert;
    if (shell && requestPerm && showAlert) {
      return {
        platform: "mobile",
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
          return showAlert({
            title: payload.title,
            ...(payload.body !== undefined ? { body: payload.body } : {}),
            ...(payload.tag !== undefined ? { tag: payload.tag } : {}),
            ...(payload.silent === true ? { silent: true } : {}),
            ...(payload.requireInteraction === true ? { requireInteraction: true } : {}),
          });
        },
        ...(webFallback.playSound !== undefined ? { playSound: webFallback.playSound } : {}),
      };
    }
  }

  return {
    platform: "mobile",
    readPermission: readLocalNotificationPermission,
    requestPermission: requestLocalNotificationPermission,
    show: showLocalNotification,
    ...(webFallback.playSound !== undefined ? { playSound: webFallback.playSound } : {}),
  };
}
