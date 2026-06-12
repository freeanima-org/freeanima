import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  jsonb,
  pgTable,
  text,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

import type { MessagePayload } from "./jsonb/message-payload.ts";
import { SEMANTIC_EMBEDDING_DIMENSIONS } from "./embedding.ts";
import { sessions } from "./sessions.ts";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const messages = pgTable(
  "messages",
  {
    /** Globally unique row id (PG PK; compression points to pos, not this column) */
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id, { onDelete: "cascade" }),
    /** Monotonic in-session sequence (compression l2/l3 point here; domain Message.pos) */
    pos: bigint("pos", { mode: "number" }).notNull(),
    payload: jsonb("payload").$type<MessagePayload>().notNull(),
    ftsSegmented: text("fts_segmented"),
    contentEmbedding: vector("content_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    /** STORED generated column; full-text search input (message_fts_input + simple config) */
    contentFts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL => sql`CASE
        WHEN (${messages.payload})->>'role' IN ('user', 'assistant')
          AND length(btrim((${messages.payload})->>'content')) > 0
        THEN to_tsvector('simple', CASE
          WHEN nullif(btrim(${messages.ftsSegmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${messages.ftsSegmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input((${messages.payload})->>'content')
        END)
        ELSE NULL
      END`,
    ),
  },
  (t) => [
    uniqueIndex("messages_session_id_pos_uidx").on(t.sessionId, t.pos),
    index("messages_content_fts_gin").using("gin", t.contentFts),
  ],
);
