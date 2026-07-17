import { sql, type SQL } from "drizzle-orm";
import { bigint, boolean, index, jsonb, pgTable, real, text, vector } from "drizzle-orm/pg-core";
import { z } from "zod";

import { pgTimestamptz } from "../columns/pg-timestamptz.ts";

import { SEMANTIC_EMBEDDING_DIMENSIONS } from "../embedding.ts";
import { tsvector } from "../tsvector.ts";

export const entityTypeSchema = z.enum(["content", "world", "agent", "user"]);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const entities = pgTable(
  "entities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    type: text("type").notNull(),
    world_id: bigint("world_id", { mode: "number" }).notNull(),
    components: text("components").array().notNull().default([]),
    primary_component: text("primary_component").notNull(),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    body: jsonb("body").notNull().default({}),
    /** Entity-level pin（任意 primary_component） */
    pinned: boolean("pinned").notNull().default(false),
    /** Entity-level citation weight sum（[[anima:id]]） */
    reference_count: real("reference_count").notNull().default(0),
    fts_segmented: text("fts_segmented"),
    search_embedding: vector("search_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    search_fts: tsvector("search_fts").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', CASE
        WHEN nullif(btrim(${entities.fts_segmented}), '') IS NOT NULL
        THEN regexp_replace(btrim(${entities.fts_segmented}), '\\s+', ' ', 'g')
        ELSE message_fts_input(
          btrim(
            coalesce(${entities.title}, '') || ' ' ||
            coalesce(${entities.summary}, '') || ' ' ||
            coalesce(${entities.content}, '')
          )
        )
      END)`,
    ),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
    updated_at: pgTimestamptz("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_entities_world_id").on(t.world_id),
    index("idx_entities_primary_component").on(t.primary_component),
    index("idx_entities_world_primary_component").on(t.world_id, t.primary_component),
    index("idx_entities_components").using("gin", t.components),
    index("idx_entities_search_fts").using("gin", t.search_fts),
    index("idx_entities_pinned").on(t.pinned),
    index("idx_entities_primary_reference_count").on(t.primary_component, t.reference_count.desc()),
    index("idx_entities_primary_pinned_updated").on(
      t.primary_component,
      t.pinned,
      t.updated_at.desc(),
    ),
    // HNSW / gin_trgm / body 表达式索引：见 migrations 追加 SQL（drizzle-kit 难表达 opclass / partial）
  ],
);

export type EntityInsert = typeof entities.$inferInsert;
export type EntitySelect = typeof entities.$inferSelect;
