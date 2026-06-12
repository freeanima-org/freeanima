import { index, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { messages } from "./messages.ts";
import { semanticMemory } from "./semantic-memory.ts";
import { sessions } from "./sessions.ts";

/** `[memory #xxx]` reference records in message body (cascade invalidate on session delete) */
export const memoryReferences = pgTable(
  "memory_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    messageId: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    semanticMemoryId: text("semantic_memory_id")
      .notNull()
      .references(() => semanticMemory.id, { onDelete: "cascade" }),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_memory_references_semantic_memory_id").on(t.semanticMemoryId),
    index("idx_memory_references_session_id").on(t.sessionId),
    index("idx_memory_references_created_at").on(t.createdAt),
    uniqueIndex("memory_references_message_memory_uidx").on(t.messageId, t.semanticMemoryId),
  ],
);
