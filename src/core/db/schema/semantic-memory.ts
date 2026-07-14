import { sql, type SQL } from "drizzle-orm";
import { boolean, index, pgTable, real, text, vector } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { z } from "zod";

import { SEMANTIC_EMBEDDING_DIMENSIONS } from "./embedding.ts";
import { tsvector } from "./tsvector.ts";

export const semanticMemoryTypeSchema = z.enum([
  "world",
  "experience",
  "opinion",
  "observation",
  "preference",
  "procedural",
  "imprint",
]);

export type SemanticMemoryType = z.infer<typeof semanticMemoryTypeSchema>;

export const semanticMemoryStatusSchema = z.enum(["active", "deprecated"]);

export type SemanticMemoryStatus = z.infer<typeof semanticMemoryStatusSchema>;

export function normalizeSemanticMemoryType(raw: string | undefined | null): SemanticMemoryType {
  if (!raw?.trim()) return "world";
  const parsed = semanticMemoryTypeSchema.safeParse(raw.trim().toLowerCase());
  return parsed.success ? parsed.data : "world";
}

export const semanticMemory = pgTable(
  "semantic_memory",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull().default("world"),
    pinned: boolean("pinned").notNull().default(false),
    content: text("content").notNull(),
    fts_segmented: text("fts_segmented"),
    content_embedding: vector("content_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    content_fts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', CASE
          WHEN nullif(btrim(${semanticMemory.fts_segmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${semanticMemory.fts_segmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input(${semanticMemory.content})
        END)`,
    ),
    source_conversations: text("source_conversations").array().notNull().default([]),
    observed_at: pgTimestamptz("observed_at"),
    occurred_at: text("occurred_at"),
    status: text("status").notNull().default("active"),
    /** Reference weight sum after per-conversation dedupe + 30-day decay (periodic full sync calibration) */
    reference_count: real("reference_count").notNull().default(0),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
    updated_at: pgTimestamptz("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_semantic_memory_fts").using("gin", t.content_fts),
    index("idx_semantic_memory_type").on(t.type),
    index("idx_semantic_memory_pinned").on(t.pinned),
    index("idx_semantic_memory_source_conversations").using("gin", t.source_conversations),
    index("idx_semantic_memory_status").on(t.status),
    index("idx_semantic_memory_status_reference_count").on(t.status, t.reference_count.desc()),
    index("idx_semantic_memory_status_pinned_updated").on(t.status, t.pinned, t.updated_at.desc()),
    // HNSW / gin_trgm：见 migrations 追加 SQL（与 messages 同源 opclass）
  ],
);
