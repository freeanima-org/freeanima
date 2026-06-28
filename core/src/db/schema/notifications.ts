import { index, jsonb, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { z } from "zod";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

export const notificationRecipientKindSchema = z.enum(["user", "agent"]);
export type NotificationRecipientKind = z.infer<typeof notificationRecipientKindSchema>;

export const notificationSourceKindSchema = z.enum(["system", "cron", "acp", "tool"]);
export type NotificationSourceKind = z.infer<typeof notificationSourceKindSchema>;

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    recipient_kind: text("recipient_kind").notNull(),
    recipient_id: text("recipient_id").notNull().default("default"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    read_at: pgTimestamptz("read_at"),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
    source_kind: text("source_kind"),
    source_ref: text("source_ref"),
  },
  (t) => [
    index("idx_notifications_recipient_created").on(t.recipient_kind, t.recipient_id, t.created_at),
    index("idx_notifications_recipient_read").on(t.recipient_kind, t.recipient_id, t.read_at),
  ],
);
