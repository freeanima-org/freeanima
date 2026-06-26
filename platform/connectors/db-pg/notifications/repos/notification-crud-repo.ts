import { randomUUID } from "node:crypto";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import {
  notifications,
  notificationRecipientKindSchema,
  notificationSourceKindSchema,
} from "@freeanima/core/db/schema";
import type {
  NotificationCreateInput,
  NotificationListOpts,
  NotificationRow,
} from "@freeanima/core/repos";
import { DEFAULT_NOTIFICATION_RECIPIENT_ID } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";

import { getDb } from "../../client.ts";
import { mapNotificationRow } from "../mappers/notification-mapper.ts";

const DEFAULT_LIST_LIMIT = 20;

function normalizeRecipientId(raw?: string): string {
  const trimmed = raw?.trim();
  return trimmed || DEFAULT_NOTIFICATION_RECIPIENT_ID;
}

function buildListConditions(opts: Omit<NotificationListOpts, "offset" | "limit">) {
  const recipientKind = notificationRecipientKindSchema.parse(opts.recipient_kind);
  const recipientId = normalizeRecipientId(opts.recipient_id);
  const conditions = [
    eq(notifications.recipientKind, recipientKind),
    eq(notifications.recipientId, recipientId),
  ];
  if (opts.read_filter === "unread") {
    conditions.push(isNull(notifications.readAt));
  }
  return conditions;
}

export async function createNotification(input: NotificationCreateInput): Promise<NotificationRow> {
  const title = input.title.trim();
  const body = input.body.trim();
  if (!title) throw new Error("title is required");
  if (!body) throw new Error("body is required");

  const recipientKind = notificationRecipientKindSchema.parse(input.recipient_kind);
  const sourceKind =
    input.source_kind == null ? null : notificationSourceKindSchema.parse(input.source_kind);

  const now = formatCstIso();
  const db = getDb();
  const rows = await db
    .insert(notifications)
    .values({
      id: randomUUID(),
      recipientKind,
      recipientId: normalizeRecipientId(input.recipient_id),
      title,
      body,
      payload: input.payload ?? null,
      readAt: null,
      createdAt: now,
      sourceKind,
      sourceRef: input.source_ref?.trim() || null,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("failed to create notification");
  return mapNotificationRow(row);
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
    .orderBy(desc(notifications.createdAt))
    .offset(offset)
    .limit(limit);
  return rows.map(mapNotificationRow);
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
  if (row.readAt != null) return mapNotificationRow(row);

  const now = formatCstIso();
  const updated = await db
    .update(notifications)
    .set({ readAt: now })
    .where(eq(notifications.id, trimmed))
    .returning();
  const next = updated[0];
  return next ? mapNotificationRow(next) : null;
}
