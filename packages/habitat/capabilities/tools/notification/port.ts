import type {
  NotificationCreateInput,
  NotificationListOpts,
  NotificationRecipientKind,
} from "@freeanima/habitat/core/db/pg/notifications/types";
import type { NotificationRow } from "@freeanima/habitat/core/db/schema/rows";

export type NotificationRecipientRef = {
  kind: NotificationRecipientKind;
  id: string;
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

let port: NotificationPort | null = null;

export function registerNotificationPort(next: NotificationPort): void {
  port = next;
}

export function getNotificationPort(): NotificationPort | null {
  return port;
}

export function resetNotificationPortForTests(): void {
  port = null;
}
