import { sql, type SQL } from "drizzle-orm";
import { boolean, customType, index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

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

/** 旧 fact 类型及 reflect 产出映射为 world */
export function normalizeSemanticMemoryType(raw: string | undefined | null): SemanticMemoryType {
  const t = String(raw ?? "world")
    .trim()
    .toLowerCase();
  if (t === "fact") return "world";
  const parsed = semanticMemoryTypeSchema.safeParse(t);
  return parsed.success ? parsed.data : "world";
}

export const semanticMemory = pgTable(
  "semantic_memory",
  {
    id: text("id").primaryKey(),
    type: text("type").notNull().default("world"),
    pinned: boolean("pinned").notNull().default(false),
    content: text("content").notNull(),
    contentFts: tsvector("content_fts").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', message_fts_input(${semanticMemory.content}))`,
    ),
    sourceSessions: text("source_sessions").array().notNull().default([]),
    observedAt: timestamp("observed_at", { withTimezone: true }),
    occurredAt: text("occurred_at"),
    status: text("status").notNull().default("active"),
    created: timestamp("created", { withTimezone: true }).notNull().defaultNow(),
    updated: timestamp("updated", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_semantic_memory_fts").using("gin", t.contentFts),
    index("idx_semantic_memory_type").on(t.type),
    index("idx_semantic_memory_pinned").on(t.pinned),
    index("idx_semantic_memory_source_sessions").using("gin", t.sourceSessions),
    index("idx_semantic_memory_status").on(t.status),
  ],
);
