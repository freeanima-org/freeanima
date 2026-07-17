import { ipcMain, Notification } from "electron";

export type AlertIpcPayload = {
  title: string;
  body?: string;
  tag?: string;
  silent?: boolean;
  requireInteraction?: boolean;
};

export type AlertScheduleIpcPayload = AlertIpcPayload & {
  atMs: number;
};

export type AlertCancelIpcPayload = {
  id?: string;
  tag?: string;
};

const liveNotifications = new Map<string, Notification>();

type PendingSchedule = {
  id: string;
  tag: string;
  timer: ReturnType<typeof setTimeout>;
  payload: AlertIpcPayload;
};

const pendingByTag = new Map<string, PendingSchedule>();
const pendingById = new Map<string, PendingSchedule>();
let scheduleSeq = 0;

function showNativeAlert(payload: AlertIpcPayload): Promise<void> {
  if (!Notification.isSupported()) {
    return Promise.reject(new Error("当前系统不支持原生通知"));
  }

  const title = payload.title?.trim();
  if (!title) {
    return Promise.reject(new Error("通知标题不能为空"));
  }

  const tag = payload.tag ?? `freeanima:alert:${Date.now()}`;
  liveNotifications.get(tag)?.close();
  liveNotifications.delete(tag);

  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const timeout = setTimeout(() => {
      finish(resolve);
    }, 4_000);

    try {
      const notification = new Notification({
        title,
        ...(payload.body ? { body: payload.body } : {}),
        silent: payload.silent === true,
        ...(payload.requireInteraction ? { timeoutType: "never" as const } : {}),
      });

      liveNotifications.set(tag, notification);

      notification.on("show", () => {
        clearTimeout(timeout);
        finish(resolve);
      });
      notification.on("failed", () => {
        clearTimeout(timeout);
        liveNotifications.delete(tag);
        finish(() => reject(new Error("原生通知显示失败")));
      });
      notification.on("close", () => {
        liveNotifications.delete(tag);
      });

      notification.show();
    } catch (e) {
      clearTimeout(timeout);
      finish(() => reject(e instanceof Error ? e : new Error(String(e))));
    }
  });
}

function forgetPending(entry: PendingSchedule): void {
  pendingByTag.delete(entry.tag);
  pendingById.delete(entry.id);
}

function cancelNativeScheduledAlert(key: AlertCancelIpcPayload): void {
  const byId = key.id ? pendingById.get(key.id) : undefined;
  const byTag = key.tag ? pendingByTag.get(key.tag) : undefined;
  const entry = byId ?? byTag;
  if (!entry) return;
  clearTimeout(entry.timer);
  forgetPending(entry);
}

function scheduleNativeAlert(payload: AlertScheduleIpcPayload): { id: string } {
  const tag = payload.tag ?? `freeanima:alert:${Date.now()}`;
  cancelNativeScheduledAlert({ tag });

  const id = `desktop:${++scheduleSeq}:${tag}`;
  const alertPayload: AlertIpcPayload = {
    title: payload.title,
    ...(payload.body !== undefined ? { body: payload.body } : {}),
    tag,
    ...(payload.silent === true ? { silent: true } : {}),
    ...(payload.requireInteraction === true ? { requireInteraction: true } : {}),
  };
  const delay = Math.max(0, payload.atMs - Date.now());
  const timer = setTimeout(() => {
    const current = pendingById.get(id);
    if (!current) return;
    forgetPending(current);
    void showNativeAlert(current.payload).catch(() => {
      /* 到期展示失败忽略 */
    });
  }, delay);

  const entry: PendingSchedule = { id, tag, timer, payload: alertPayload };
  pendingByTag.set(tag, entry);
  pendingById.set(id, entry);
  return { id };
}

/** 退出前清掉进程级预登记。 */
export function clearAllScheduledNativeAlerts(): void {
  for (const entry of pendingById.values()) {
    clearTimeout(entry.timer);
  }
  pendingByTag.clear();
  pendingById.clear();
}

export function registerAlertIpc(): void {
  ipcMain.handle("shell:alert:show", (_event, payload: AlertIpcPayload) =>
    showNativeAlert(payload),
  );
  ipcMain.handle("shell:alert:request-permission", () => {
    if (!Notification.isSupported()) return "unsupported" as const;
    return "granted" as const;
  });
  ipcMain.handle("shell:alert:schedule", (_event, payload: AlertScheduleIpcPayload) =>
    scheduleNativeAlert(payload),
  );
  ipcMain.handle("shell:alert:cancel", (_event, payload: AlertCancelIpcPayload) => {
    cancelNativeScheduledAlert(payload ?? {});
  });
}

/** @internal 测试用 */
export function resetLiveNativeAlertsForTest(): void {
  for (const n of liveNotifications.values()) {
    n.close();
  }
  liveNotifications.clear();
  clearAllScheduledNativeAlerts();
  scheduleSeq = 0;
}
