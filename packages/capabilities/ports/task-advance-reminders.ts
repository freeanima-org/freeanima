import type { NotificationLink } from "@freeanima/shared/notification-link";

export type TaskAdvanceReminderPayload = {
  task_item_id: number;
  title: string;
  body: string;
  at: string;
  source_ref: string;
  /** 本机提醒（伴侣气泡）跳转目标；无目标 = null */
  link?: NotificationLink | null;
};

/**
 * 任务提醒提前量事件（服务端 emit / 特性 watch）。
 *
 * 注册表放在端口层，让 `server/boot/task-advance-reminder-events` 与
 * `features/task` 都能使用而不互相依赖。
 */
const watchers = new Set<(payload: TaskAdvanceReminderPayload) => void>();

export function watchTaskAdvanceReminder(
  cb: (payload: TaskAdvanceReminderPayload) => void,
): () => void {
  watchers.add(cb);
  return () => {
    watchers.delete(cb);
  };
}

export function emitTaskAdvanceReminder(payload: TaskAdvanceReminderPayload): void {
  for (const cb of watchers) {
    cb(payload);
  }
}

/** @internal */
export function resetTaskAdvanceReminderWatchersForTest(): void {
  watchers.clear();
}
