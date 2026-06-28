import { sql, type SQL } from "drizzle-orm";
import { index, pgTable, text, timestamp, vector } from "drizzle-orm/pg-core";
import { z } from "zod";

import { SEMANTIC_EMBEDDING_DIMENSIONS } from "./embedding.ts";
import { tsvector } from "./tsvector.ts";

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
    fts_segmented: text("fts_segmented"),
    content_embedding: vector("content_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    content_fts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', CASE
          WHEN nullif(btrim(${autobiographicalMemory.fts_segmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${autobiographicalMemory.fts_segmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input(
            btrim(${autobiographicalMemory.title}) || E'\\n' || btrim(${autobiographicalMemory.content})
          )
        END)`,
    ),
    significance: text("significance").notNull().default("normal"),
    period_start: text("period_start"),
    period_end: text("period_end"),
    source_facts: text("source_facts").array().notNull().default([]),
    source_conversations: text("source_conversations").array().notNull().default([]),
    status: text("status").notNull().default("active"),
    created_at: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updated_at: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_autobiographical_memory_fts").using("gin", t.content_fts),
    index("idx_autobiographical_memory_status").on(t.status),
    index("idx_autobiographical_memory_significance").on(t.significance),
    index("idx_autobiographical_memory_updated").on(t.updated_at.desc()),
    index("idx_autobiographical_memory_source_facts").using("gin", t.source_facts),
    index("idx_autobiographical_memory_source_conversations").using("gin", t.source_conversations),
  ],
);
