import { bigint, index, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { conversations } from "./conversations.ts";

/**
 * 用户已读水位（per conversation + user subject）。
 * subject_id 恒为 Habitat user subject；不服务 agent 未读。
 */
export const conversationReadState = pgTable(
  "conversation_read_state",
  {
    conversation_id: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    subject_id: text("subject_id").notNull(),
    last_read_pos: bigint("last_read_pos", { mode: "number" }).notNull().default(0),
    read_at: pgTimestamptz("read_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.conversation_id, t.subject_id] }),
    index("idx_conversation_read_state_subject").on(t.subject_id),
  ],
);
