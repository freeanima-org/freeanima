import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  notifications,
  notificationRecipientKindSchema,
  notificationSourceKindSchema,
} from "@freeanima/host/core/db/schema";
import type { NotificationCreateInput, NotificationListOpts, NotificationRow } from "../types.ts";
import { DEFAULT_NOTIFICATION_RECIPIENT_ID } from "../types.ts";

import { getDb } from "../../client.ts";

const DEFAULT_LIST_LIMIT = 20;

function normalizeRecipientId(raw?: string): string {
  const trimmed = raw?.trim();
  return trimmed || DEFAULT_NOTIFICATION_RECIPIENT_ID;
}

function buildListConditions(opts: Omit<NotificationListOpts, "offset" | "limit">) {
  const recipient_kind = notificationRecipientKindSchema.parse(opts.recipient_kind);
  const recipient_id = normalizeRecipientId(opts.recipient_id);
  const conditions = [
    eq(notifications.recipient_kind, recipient_kind),
    eq(notifications.recipient_id, recipient_id),
  ];
  if (opts.read_filter === "unread") {
    conditions.push(isNull(notifications.read_at));
  }
  return conditions;
}

export async function createNotification(input: NotificationCreateInput): Promise<NotificationRow> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new Error("title is required");
  if (!body) throw new Error("body is required");

  const recipient_kind = notificationRecipientKindSchema.parse(input.recipient_kind);
  const source_kind =
    input.source_kind == null ? null : notificationSourceKindSchema.parse(input.source_kind);

  const now = new Date();
  const db = getDb();
  const rows = await db
    .insert(notifications)
    .values({
      id: randomUUID(),
      recipient_kind,
      recipient_id: normalizeRecipientId(input.recipient_id),
      title,
      body,
      payload: input.payload ?? null,
      read_at: null,
      created_at: now,
      source_kind,
      source_ref: input.source_ref?.trim() || null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("failed to create notification");
  return row;
}

export async function listNotifications(opts: NotificationListOpts): Promise<NotificationRow[]> {
  const limit = Math.max(1, Math.min(100, opts.limit ?? DEFAULT_LIST_LIMIT));
  const offset = Math.max(0, opts.offset ?? 0);
  const conditions = buildListConditions(opts);

  const db = getDb();
  const rows = await db
    .select()
    .from(notifications)
    .where(and(...conditions))
    .orderBy(desc(notifications.created_at))
    .offset(offset)
    .limit(limit);
  return rows;
}

export async function countNotifications(
  opts: Omit<NotificationListOpts, "offset" | "limit">,
): Promise<number> {
  const conditions = buildListConditions(opts);
  const db = getDb();
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(...conditions));
  return Number(rows[0]?.n ?? 0);
}

export async function markNotificationRead(id: string): Promise<NotificationRow | null> {
  const trimmed = id.trim();
  if (!trimmed) return null;

  const db = getDb();
  const existing = await db
    .select()
    .from(notifications)
    .where(eq(notifications.id, trimmed))
    .limit(1);
  const row = existing[0];
  if (!row) return null;
  if (row.read_at != null) return row;

  const now = new Date();
  const updated = await db
    .update(notifications)
    .set({ read_at: now })
    .where(eq(notifications.id, trimmed))
    .returning();
  const next = updated[0];
  return next ? next : null;
}

export async function notificationExistsBySourceRef(
  sourceRef: string,
  opts: Pick<NotificationListOpts, "recipient_kind" | "recipient_id">,
): Promise<boolean> {
  const trimmed = sourceRef.trim();
  if (!trimmed) return false;

  const recipient_kind = notificationRecipientKindSchema.parse(opts.recipient_kind);
  const recipient_id = normalizeRecipientId(opts.recipient_id);
  const db = getDb();
  const rows = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.source_ref, trimmed),
        eq(notifications.recipient_kind, recipient_kind),
        eq(notifications.recipient_id, recipient_id),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

export async function markNotificationsReadBySourceRef(
  sourceRef: string,
  opts: Pick<NotificationListOpts, "recipient_kind" | "recipient_id">,
): Promise<number> {
  const trimmed = sourceRef.trim();
  if (!trimmed) return 0;

  const recipient_kind = notificationRecipientKindSchema.parse(opts.recipient_kind);
  const recipient_id = normalizeRecipientId(opts.recipient_id);
  const now = new Date();
  const db = getDb();
  const updated = await db
    .update(notifications)
    .set({ read_at: now })
    .where(
      and(
        eq(notifications.source_ref, trimmed),
        eq(notifications.recipient_kind, recipient_kind),
        eq(notifications.recipient_id, recipient_id),
        isNull(notifications.read_at),
      ),
    )
    .returning({ id: notifications.id });
  return updated.length;
}
