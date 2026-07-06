import { sql, type SQL } from "drizzle-orm";
import { index, pgTable, real, text, uuid, vector } from "drizzle-orm/pg-core";
import { z } from "zod";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";

import { SEMANTIC_EMBEDDING_DIMENSIONS } from "./embedding.ts";
import { tsvector } from "./tsvector.ts";

export const limbicKindSchema = z.enum(["conversation_mood", "turning_point", "spike"]);

export type LimbicKind = z.infer<typeof limbicKindSchema>;

/** Limbic memory (emotion/intensity; not injected into system prompt) */
export const limbicMemory = pgTable(
  "limbic_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversation_id: text("conversation_id").notNull(),
    kind: text("kind").notNull(),
    valence: real("valence"),
    arousal: real("arousal"),
    content: text("content").notNull(),
    fts_segmented: text("fts_segmented"),
    content_embedding: vector("content_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    content_fts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', CASE
          WHEN nullif(btrim(${limbicMemory.fts_segmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${limbicMemory.fts_segmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input(${limbicMemory.content})
        END)`,
    ),
    intensity: real("intensity").notNull().default(0.5),
    source_segment: text("source_segment"),
    semantic_memory_ids: text("semantic_memory_ids").array().notNull().default([]),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_limbic_memory_fts").using("gin", t.content_fts),
    index("idx_limbic_memory_semantic_memory_ids").using("gin", t.semantic_memory_ids),
    index("idx_limbic_memory_conversation_id").on(t.conversation_id),
    index("idx_limbic_memory_created_at").on(t.created_at),
    index("idx_limbic_memory_kind").on(t.kind),
    index("idx_limbic_memory_intensity").on(t.intensity),
    index("idx_limbic_memory_valence").on(t.valence),
    index("idx_limbic_memory_arousal").on(t.arousal),
  ],
);
