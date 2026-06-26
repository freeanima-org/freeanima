import { index, jsonb, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

export const notificationRecipientKindSchema = z.enum(["user", "agent"]);
export type NotificationRecipientKind = z.infer<typeof notificationRecipientKindSchema>;

export const notificationSourceKindSchema = z.enum(["system", "cron", "acp", "tool"]);
export type NotificationSourceKind = z.infer<typeof notificationSourceKindSchema>;

export const notifications = pgTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    recipientKind: text("recipient_kind").notNull(),
    recipientId: text("recipient_id").notNull().default("default"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    payload: jsonb("payload").$type<Record<string, unknown> | null>(),
    readAt: timestamp("read_at", { withTimezone: true, mode: "string" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    sourceKind: text("source_kind"),
    sourceRef: text("source_ref"),
  },
  (t) => [
    index("idx_notifications_recipient_created").on(t.recipientKind, t.recipientId, t.createdAt),
    index("idx_notifications_recipient_read").on(t.recipientKind, t.recipientId, t.readAt),
  ],
);
