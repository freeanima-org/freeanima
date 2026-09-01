import type {
  NotificationCreateInput,
  NotificationRecipientKind,
  NotificationReadFilter,
} from "@freeanima/habitat/core/db/pg/notifications/types";
import type { NotificationRow } from "@freeanima/habitat/core/db/schema/rows";
import {
  countNotifications,
  createNotification as createPgNotification,
  listNotifications as listPgNotifications,
  markAllNotificationsReadBySourceRef,
  markNotificationRead as markPgNotificationRead,
} from "@freeanima/habitat/core/db/pg/notifications";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { emitUserNotificationCreated } from "./user-inbox-events.ts";

export type NotificationListResult = {
  items: NotificationRow[];
  total: number;
  offset: number;
  limit: number;
};

function clampPagination(offset?: number, limit?: number) {
  const safeLimit = Math.max(1, Math.min(100, limit ?? 20));
  const safeOffset = Math.max(0, offset ?? 0);
  return { offset: safeOffset, limit: safeLimit };
}

function requireRecipientId(recipientId: number | undefined): number {
  if (recipientId == null || !Number.isFinite(recipientId) || recipientId <= 0) {
    throw new Error("recipient_id is required (positive entities.id)");
  }
  return Math.floor(recipientId);
}

export async function listNotifications(
  _deps: RuntimeDeps,
  args: {
    recipient_kind: NotificationRecipientKind;
    recipient_id: number;
    read_filter?: NotificationReadFilter;
    offset?: number;
    limit?: number;
  },
): Promise<NotificationListResult> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts = {
    recipient_kind: args.recipient_kind,
    recipient_id: requireRecipientId(args.recipient_id),
    read_filter: args.read_filter ?? "all",
  };
  const [items, total] = await Promise.all([
    listPgNotifications({ ...filterOpts, offset, limit }),
    countNotifications(filterOpts),
  ]);
  return { items, total, offset, limit };
}

export async function markNotificationRead(
  _deps: RuntimeDeps,
  id: string,
): Promise<NotificationRow | null> {
  const row = await markPgNotificationRead(id.trim());
  if (row == null) return null;
  // soft-failure / cron 等会 user+agent 双写同一 source_ref；任一侧已读则两侧都清，避免卧室已读仍旁侧注入
  const sourceRef = row.source_ref?.trim();
  if (sourceRef) {
    await markAllNotificationsReadBySourceRef(sourceRef);
  }
  return row;
}

export async function createNotification(
  _deps: RuntimeDeps,
  input: NotificationCreateInput,
): Promise<NotificationRow> {
  const row = await createPgNotification({
    ...input,
    recipient_id: requireRecipientId(input.recipient_id),
  });
  if (row.recipient_kind === "user") {
    emitUserNotificationCreated({
      id: row.id,
      title: row.title,
      body: row.body,
      created_at: row.created_at.toISOString(),
    });
  }
  return row;
}
