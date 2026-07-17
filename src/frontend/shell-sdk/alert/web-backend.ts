/// <reference lib="dom" />
import type {
  AlertBackend,
  AlertPermissionState,
  AlertPayload,
  AlertScheduleKey,
  AlertScheduleResult,
} from "./types.ts";

let audioContext: AudioContext | null = null;

/** 持有引用，避免 Notification 被 GC 后立即关闭（常见 Web 通知不显示原因）。 */
const liveNotifications = new Map<string, Notification>();

type PendingSchedule = {
  id: string;
  tag: string;
  timer: ReturnType<typeof setTimeout>;
};

const pendingByTag = new Map<string, PendingSchedule>();
const pendingById = new Map<string, PendingSchedule>();
let scheduleSeq = 0;

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

function forgetPending(entry: PendingSchedule): void {
  pendingByTag.delete(entry.tag);
  pendingById.delete(entry.id);
}

async function cancelPending(key: AlertScheduleKey): Promise<void> {
  const byId = key.id ? pendingById.get(key.id) : undefined;
  const byTag = key.tag ? pendingByTag.get(key.tag) : undefined;
  const entry = byId ?? byTag;
  if (!entry) return;
  clearTimeout(entry.timer);
  forgetPending(entry);
}

export function createWebAlertBackend(): AlertBackend {
  const backend: AlertBackend = {
    platform: "web",
    scheduleDurability: "process",
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
    async schedule(payload: AlertPayload, at: Date): Promise<AlertScheduleResult> {
      const tag = payload.tag ?? `freeanima:alert:${Date.now()}`;
      await cancelPending({ tag });

      const id = `web:${++scheduleSeq}:${tag}`;
      const delay = Math.max(0, at.getTime() - Date.now());
      const timer = setTimeout(() => {
        const current = pendingById.get(id);
        if (!current) return;
        forgetPending(current);
        void backend.show({ ...payload, tag }).catch(() => {
          /* 到期展示失败忽略 */
        });
        if (payload.sound) playBeep();
      }, delay);

      const entry: PendingSchedule = { id, tag, timer };
      pendingByTag.set(tag, entry);
      pendingById.set(id, entry);
      return { id };
    },
    cancel(key: AlertScheduleKey): Promise<void> {
      return cancelPending(key);
    },
  };
  return backend;
}

/** @internal 测试用 */
export function resetLiveWebNotificationsForTest(): void {
  for (const n of liveNotifications.values()) {
    n.close();
  }
  liveNotifications.clear();
  for (const entry of pendingById.values()) {
    clearTimeout(entry.timer);
  }
  pendingByTag.clear();
  pendingById.clear();
}
