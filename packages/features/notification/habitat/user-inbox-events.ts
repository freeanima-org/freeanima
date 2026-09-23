import type { NotificationLink } from "@freeanima/shared/notification-link";

export type UserNotificationCreatedPayload = {
  id: string;
  title: string;
  body: string;
  created_at: string;
  /** 本机提醒（伴侣气泡）跳转目标；无目标 = null */
  link?: NotificationLink | null;
};

const watchers = new Set<(payload: UserNotificationCreatedPayload) => void>();

export function watchUserNotificationCreated(
  cb: (payload: UserNotificationCreatedPayload) => void,
): () => void {
  watchers.add(cb);
  return () => {
    watchers.delete(cb);
  };
}

export function emitUserNotificationCreated(payload: UserNotificationCreatedPayload): void {
  for (const cb of watchers) {
    cb(payload);
  }
}

/** @internal */
export function resetUserNotificationWatchersForTest(): void {
  watchers.clear();
}
