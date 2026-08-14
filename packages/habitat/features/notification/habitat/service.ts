import type {
  NotificationCreateInput,
  NotificationRecipientKind,
  NotificationReadFilter,
} from "@freeanima/habitat/core/db/pg/notifications/types";
import type { NotificationRow } from "@freeanima/habitat/core/db/schema/rows";
import { DEFAULT_NOTIFICATION_RECIPIENT_ID } from "@freeanima/habitat/core/db/pg/notifications/types";
import {
  countNotifications,
  createNotification as createPgNotification,
  listNotifications as listPgNotifications,
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

function resolveRecipientId(recipientId?: string): string {
  const trimmed = recipientId?.trim();
  return trimmed || DEFAULT_NOTIFICATION_RECIPIENT_ID;
}

export async function listNotifications(
  _deps: RuntimeDeps,
  args: {
    recipient_kind: NotificationRecipientKind;
    recipient_id?: string;
    read_filter?: NotificationReadFilter;
    offset?: number;
    limit?: number;
  },
): Promise<NotificationListResult> {
  const { offset, limit } = clampPagination(args.offset, args.limit);
  const filterOpts = {
    recipient_kind: args.recipient_kind,
    recipient_id: resolveRecipientId(args.recipient_id),
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
  return markPgNotificationRead(id.trim());
}

export async function createNotification(
  _deps: RuntimeDeps,
  input: NotificationCreateInput,
): Promise<NotificationRow> {
  const row = await createPgNotification({
    ...input,
    recipient_id: resolveRecipientId(input.recipient_id),
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
