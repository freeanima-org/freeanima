/// <reference lib="dom" />
import type { AlertBackend, AlertPermissionState, AlertPayload } from "./types.ts";

let audioContext: AudioContext | null = null;

/** 持有引用，避免 Notification 被 GC 后立即关闭（常见 Web 通知不显示原因）。 */
const liveNotifications = new Map<string, Notification>();

function notificationSupported(): boolean {
  return typeof Notification !== "undefined";
}

function playBeep(): void {
  try {
    const Ctx =
      window.AudioContext ??
      (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    audioContext ??= new Ctx();
    const ctx = audioContext;
    void ctx.resume();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.08;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  } catch {
    /* 忽略音效失败 */
  }
}

function showWebNotification(payload: AlertPayload): Promise<void> {
  if (!notificationSupported()) {
    return Promise.reject(new Error("当前环境不支持 Notification API"));
  }
  if (Notification.permission !== "granted") {
    return Promise.reject(new Error("通知权限未授予"));
  }

  const tag = payload.tag ?? `freeanima:alert:${Date.now()}`;
  const previous = liveNotifications.get(tag);
  previous?.close();
  liveNotifications.delete(tag);

  const options: NotificationOptions = { tag };
  if (payload.body) options.body = payload.body;
  if (payload.requireInteraction) options.requireInteraction = true;

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const timeout = window.setTimeout(() => {
      finish(resolve);
    }, 4_000);

    try {
      const notification = new Notification(payload.title, options);
      liveNotifications.set(tag, notification);

      notification.addEventListener("show", () => {
        window.clearTimeout(timeout);
        finish(resolve);
      });
      notification.addEventListener("error", () => {
        window.clearTimeout(timeout);
        liveNotifications.delete(tag);
        finish(() => reject(new Error("系统通知显示失败（onerror）")));
      });
      notification.addEventListener("close", () => {
        liveNotifications.delete(tag);
      });
    } catch (e) {
      window.clearTimeout(timeout);
      finish(() => reject(e instanceof Error ? e : new Error(String(e))));
    }
  });
}

export function createWebAlertBackend(): AlertBackend {
  return {
    platform: "web",
    async readPermission(): Promise<AlertPermissionState> {
      if (!notificationSupported()) return "unsupported";
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";
      return "default";
    },
    async requestPermission(): Promise<AlertPermissionState> {
      if (!notificationSupported()) return "unsupported";
      if (Notification.permission === "granted") return "granted";
      if (Notification.permission === "denied") return "denied";
      const result = await Notification.requestPermission();
      if (result === "granted") return "granted";
      if (result === "denied") return "denied";
      return "default";
    },
    show(payload: AlertPayload): Promise<void> {
      return showWebNotification(payload);
    },
    playSound: playBeep,
  };
}

/** @internal 测试用 */
export function resetLiveWebNotificationsForTest(): void {
  for (const n of liveNotifications.values()) {
    n.close();
  }
  liveNotifications.clear();
}
