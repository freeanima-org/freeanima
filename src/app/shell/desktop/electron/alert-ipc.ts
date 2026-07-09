import { ipcMain, Notification } from "electron";

export type AlertIpcPayload = {
  title: string;
  body?: string;
  tag?: string;
  silent?: boolean;
  requireInteraction?: boolean;
};

const liveNotifications = new Map<string, Notification>();

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

export function registerAlertIpc(): void {
  ipcMain.handle("shell:alert:show", (_event, payload: AlertIpcPayload) =>
    showNativeAlert(payload),
  );
  ipcMain.handle("shell:alert:request-permission", () => {
    if (!Notification.isSupported()) return "unsupported" as const;
    return "granted" as const;
  });
}

/** @internal 测试用 */
export function resetLiveNativeAlertsForTest(): void {
  for (const n of liveNotifications.values()) {
    n.close();
  }
  liveNotifications.clear();
}
