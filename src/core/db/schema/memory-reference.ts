import { bigint, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

import { messages } from "./messages.ts";
import { entities } from "./entity/entity.ts";
import { conversations } from "./conversations.ts";

/** `[[anima:{id}]]` reference records in message body (cascade invalidate on conversation delete) */
export const memoryReferences = pgTable(
  "memory_references",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    message_id: text("message_id")
      .notNull()
      .references(() => messages.id, { onDelete: "cascade" }),
    entity_id: bigint("entity_id", { mode: "number" })
      .notNull()
      .references(() => entities.id, { onDelete: "cascade" }),
    conversation_id: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_memory_references_entity_id").on(t.entity_id),
    index("idx_memory_references_conversation_id").on(t.conversation_id),
    index("idx_memory_references_created_at").on(t.created_at),
    uniqueIndex("memory_references_message_entity_uidx").on(t.message_id, t.entity_id),
  ],
);
