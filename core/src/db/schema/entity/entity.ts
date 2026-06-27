import { sql, type SQL } from "drizzle-orm";
import {
  bigint,
  customType,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  vector,
} from "drizzle-orm/pg-core";
import { z } from "zod";

import { SEMANTIC_EMBEDDING_DIMENSIONS } from "../embedding.ts";

const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const entityTypeSchema = z.enum(["content", "world", "agent", "user"]);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const entities = pgTable(
  "entities",
  {
    id: bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity(),
    type: text("type").notNull(),
    worldId: bigint("world_id", { mode: "number" }).notNull(),
    components: text("components").array().notNull().default([]),
    primaryComponent: text("primary_component").notNull(),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    body: jsonb("body").notNull().default({}),
    ftsSegmented: text("fts_segmented"),
    searchEmbedding: vector("search_embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    searchFts: tsvector("search_fts").generatedAlwaysAs(
      (): SQL => sql`to_tsvector('simple', CASE
        WHEN nullif(btrim(${entities.ftsSegmented}), '') IS NOT NULL
        THEN regexp_replace(btrim(${entities.ftsSegmented}), '\\s+', ' ', 'g')
        ELSE message_fts_input(
          btrim(
            coalesce(${entities.title}, '') || ' ' ||
            coalesce(${entities.summary}, '') || ' ' ||
            coalesce(${entities.content}, '')
          )
        )
      END)`,
    ),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("idx_entities_world_id").on(t.worldId),
    index("idx_entities_primary_component").on(t.primaryComponent),
    index("idx_entities_components").using("gin", t.components),
    index("idx_entities_search_fts").using("gin", t.searchFts),
  ],
);

export type EntityInsert = typeof entities.$inferInsert;
export type EntitySelect = typeof entities.$inferSelect;
