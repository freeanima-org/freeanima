import type {
  NotificationRecipientKind,
  NotificationRow,
  NotificationSourceKind,
} from "@freeanima/core/repos";
import {
  normalizePgTimestamp,
  notificationRecipientKindSchema,
  notificationSourceKindSchema,
} from "@freeanima/core/db/schema";
import type { notifications } from "@freeanima/core/db/schema";

export type NotificationDbRow = typeof notifications.$inferSelect;

function normalizeRecipientKind(raw: string): NotificationRecipientKind {
  const parsed = notificationRecipientKindSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid notification recipient_kind: ${raw}`);
  return parsed.data;
}

function normalizeSourceKind(raw: string | null): NotificationSourceKind | null {
  if (raw == null) return null;
  const parsed = notificationSourceKindSchema.safeParse(raw);
  if (!parsed.success) throw new Error(`invalid notification source_kind: ${raw}`);
  return parsed.data;
}

export function mapNotificationRow(row: NotificationDbRow): NotificationRow {
  return {
    id: row.id,
    recipient_kind: normalizeRecipientKind(row.recipient_kind),
    recipient_id: row.recipient_id,
    title: row.title,
    body: row.body,
    payload: row.payload ?? null,
    read_at: row.read_at != null ? normalizePgTimestamp(row.read_at) : null,
    created_at: normalizePgTimestamp(row.created_at),
    source_kind: normalizeSourceKind(row.source_kind),
    source_ref: row.source_ref,
  };
}
