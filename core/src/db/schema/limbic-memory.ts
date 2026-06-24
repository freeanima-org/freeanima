import { sql, type SQL } from "drizzle-orm";
import {
  customType,
  index,
  pgTable,
  real,
  text,
  timestamp,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { SEMANTIC_EMBEDDING_DIMENSIONS } from "./embedding.ts";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const limbicKindSchema = z.enum(["conversation_mood", "turning_point", "spike"]);

export type LimbicKind = z.infer<typeof limbicKindSchema>;

/** Limbic memory (emotion/intensity; not injected into system prompt) */
export const limbicMemory = pgTable(
  "limbic_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    conversationId: text("conversation_id").notNull(),
    kind: text("kind").notNull(),
    valence: real("valence"),
    arousal: real("arousal"),
    content: text("content").notNull(),
    ftsSegmented: text("fts_segmented"),
    contentEmbedding: vector("content_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    contentFts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', CASE
          WHEN nullif(btrim(${limbicMemory.ftsSegmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${limbicMemory.ftsSegmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input(${limbicMemory.content})
        END)`,
    ),
    intensity: real("intensity").notNull().default(0.5),
    sourceSegment: text("source_segment"),
    semanticMemoryIds: text("semantic_memory_ids").array().notNull().default([]),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_limbic_memory_fts").using("gin", t.contentFts),
    index("idx_limbic_memory_semantic_memory_ids").using("gin", t.semanticMemoryIds),
    index("idx_limbic_memory_conversation_id").on(t.conversationId),
    index("idx_limbic_memory_created_at").on(t.createdAt),
    index("idx_limbic_memory_kind").on(t.kind),
    index("idx_limbic_memory_intensity").on(t.intensity),
    index("idx_limbic_memory_valence").on(t.valence),
    index("idx_limbic_memory_arousal").on(t.arousal),
  ],
);
