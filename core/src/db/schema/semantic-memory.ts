import { sql, type SQL } from "drizzle-orm";
import { boolean, index, pgTable, real, text, timestamp, vector } from "drizzle-orm/pg-core";
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
    ftsSegmented: text("fts_segmented"),
    contentEmbedding: vector("content_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    contentFts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL =>
        sql`to_tsvector('simple', CASE
          WHEN nullif(btrim(${semanticMemory.ftsSegmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${semanticMemory.ftsSegmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input(${semanticMemory.content})
        END)`,
    ),
    sourceConversations: text("source_conversations").array().notNull().default([]),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    occurredAt: text("occurred_at"),
    status: text("status").notNull().default("active"),
    /** Reference weight sum after per-conversation dedupe + 30-day decay (periodic full sync calibration) */
    referenceCount: real("reference_count").notNull().default(0),
    created: timestamp("created", { withTimezone: true }).notNull().defaultNow(),
    updated: timestamp("updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_semantic_memory_fts").using("gin", t.contentFts),
    index("idx_semantic_memory_type").on(t.type),
    index("idx_semantic_memory_pinned").on(t.pinned),
    index("idx_semantic_memory_source_conversations").using("gin", t.sourceConversations),
    index("idx_semantic_memory_status").on(t.status),
  ],
);
