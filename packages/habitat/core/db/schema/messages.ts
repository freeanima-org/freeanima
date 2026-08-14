import { bigint, jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import type { MessagePayload } from "./jsonb/message-payload.ts";
import { conversations } from "./conversations.ts";

/** Conversation messages — rebuildable search fields live on `search_documents`. */
export const messages = pgTable(
  "messages",
  {
    /** Globally unique row id (PG PK; compression points to pos, not this column) */
    id: text("id").primaryKey(),
    conversation_id: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    /** Monotonic in-conversation sequence (compression l2/l3 point here; domain Message.pos) */
    pos: bigint("pos", { mode: "number" }).notNull(),
    payload: jsonb("payload").$type<MessagePayload>().notNull(),
  },
  (t) => [uniqueIndex("messages_conversation_id_pos_uidx").on(t.conversation_id, t.pos)],
);
