import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { messages } from "./messages.ts";
import { semanticMemory } from "./semantic-memory.ts";
import { conversations } from "./conversations.ts";

/** `[[f-xxx]]` reference records in message body (cascade invalidate on conversation delete) */
export const memoryReferences = pgTable(
  "memory_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    message_id: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    semantic_memory_id: text("semantic_memory_id")
      .notNull()
      .references(() => semanticMemory.id, { onDelete: "cascade" }),
    conversation_id: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_memory_references_semantic_memory_id").on(t.semantic_memory_id),
    index("idx_memory_references_conversation_id").on(t.conversation_id),
    index("idx_memory_references_created_at").on(t.created_at),
    uniqueIndex("memory_references_message_memory_uidx").on(t.message_id, t.semantic_memory_id),
  ],
);
