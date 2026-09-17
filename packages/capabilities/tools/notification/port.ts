import { getRootContextOrNull } from "@freeanima/kernel";
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
 * Resolve the notification port from the Cordis service (`ctx.notifications`
 * on the process context).
 *
 * No module-level singleton state: `NotificationService` is the single
 * provider. Returns null before boot / when the service is not mounted, which
 * is the contract existing deep and background consumers rely on.
 */
export function getNotificationPort(): NotificationPort | null {
  return getRootContextOrNull()?.notifications?.port ?? null;
}
