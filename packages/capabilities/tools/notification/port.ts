import type {
  NotificationCreateInput,
  NotificationListOpts,
  NotificationRecipientKind,
} from "@freeanima/core/db/pg/notifications/types";
import type { NotificationRow } from "@freeanima/core/db/schema/rows";

export type NotificationRecipientRef = {
  kind: NotificationRecipientKind;
  id: number;
};

export type NotificationPort = {
  create(input: NotificationCreateInput): Promise<NotificationRow>;
  list(opts: NotificationListOpts): Promise<NotificationRow[]>;
  markRead(id: string): Promise<NotificationRow | null>;
  markReadBySourceRef(sourceRef: string, recipient: NotificationRecipientRef): Promise<number>;
  existsBySourceRef(sourceRef: string, recipient: NotificationRecipientRef): Promise<boolean>;
  getAgentRecipient(): NotificationRecipientRef;
  getUserRecipient(): NotificationRecipientRef;
};

/**
 * 当前通知端口（由 `NotificationService` 挂载时登记）。
 *
 * 深层与后台消费者没有 ctx：直接读该模块内句柄，不再查进程根 context。
 * 未挂载返回 null——既有深/后台消费者依赖该契约。
 */
let current: NotificationPort | null = null;

/** 由 NotificationService 登记；传 null 清除。 */
export function setNotificationPort(port: NotificationPort | null): void {
  current = port;
}

export function getNotificationPort(): NotificationPort | null {
  return current;
}
