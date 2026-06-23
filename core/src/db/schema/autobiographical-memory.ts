import { sql, type SQL } from "drizzle-orm";
import { customType, index, pgTable, text, timestamp, vector } from "drizzle-orm/pg-core";
import { z } from "zod";

import { SEMANTIC_EMBEDDING_DIMENSIONS } from "./embedding.ts";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const autobiographicalSignificanceSchema = z.enum(["normal", "milestone", "turning_point"]);

export type AutobiographicalSignificance = z.infer<typeof autobiographicalSignificanceSchema>;

export const autobiographicalStatusSchema = z.enum(["active", "deprecated"]);

export type AutobiographicalStatus = z.infer<typeof autobiographicalStatusSchema>;

/** Autobiographical narrative (append-only; body not updatable, deprecate only) */
export const autobiographicalMemory = pgTable(
  "autobiographical_memory",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    content: text("content").notNull(),
    ftsSegmented: text("fts_segmented"),
    contentEmbedding: vector("content_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    contentFts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', CASE
          WHEN nullif(btrim(${autobiographicalMemory.ftsSegmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${autobiographicalMemory.ftsSegmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input(
            btrim(${autobiographicalMemory.title}) || E'\\n' || btrim(${autobiographicalMemory.content})
          )
        END)`,
    ),
    significance: text("significance").notNull().default("normal"),
    periodStart: text("period_start"),
    periodEnd: text("period_end"),
    sourceFacts: text("source_facts").array().notNull().default([]),
    sourceSessions: text("source_sessions").array().notNull().default([]),
    status: text("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_autobiographical_memory_fts").using("gin", t.contentFts),
    index("idx_autobiographical_memory_status").on(t.status),
    index("idx_autobiographical_memory_significance").on(t.significance),
    index("idx_autobiographical_memory_updated").on(t.updatedAt.desc()),
    index("idx_autobiographical_memory_source_facts").using("gin", t.sourceFacts),
    index("idx_autobiographical_memory_source_sessions").using("gin", t.sourceSessions),
  ],
);
