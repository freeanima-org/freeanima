import { sql, type SQL } from "drizzle-orm";
import { bigint, index, integer, pgTable, text, vector } from "drizzle-orm/pg-core";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { SEMANTIC_EMBEDDING_DIMENSIONS } from "./embedding.ts";
import { tsvector } from "./tsvector.ts";

/**
 * Rebuildable search index (side table). Business truth stays on entities/messages.
 * First deployment: same database; connection may later point elsewhere without Port changes.
 */
export const searchDocuments = pgTable(
  "search_documents",
  {
    doc_key: text("doc_key").primaryKey(),
    resource: text("resource").notNull(),
    source_id: text("source_id").notNull(),
    world_id: bigint("world_id", { mode: "number" }),
    primary_component: text("primary_component"),
    conversation_id: text("conversation_id"),
    message_role: text("message_role"),
    deleted_at: pgTimestamptz("deleted_at"),
    title: text("title").notNull().default(""),
    summary: text("summary").notNull().default(""),
    content: text("content").notNull().default(""),
    fts_segmented: text("fts_segmented"),
    embedding: vector("embedding", { dimensions: SEMANTIC_EMBEDDING_DIMENSIONS }),
    /** 语义记忆向量簇（DBSCAN）；旁表派生字段，重建索引后可为空直至再校准 */
    cluster_id: integer("cluster_id"),
    search_fts: tsvector("search_fts").generatedAlwaysAs(
      (): SQL => sql`CASE
        WHEN ${searchDocuments.resource} = 'message'
          AND (
            ${searchDocuments.message_role} IS NULL
            OR ${searchDocuments.message_role} NOT IN ('user', 'assistant')
            OR length(btrim(${searchDocuments.content})) = 0
          )
        THEN NULL
        ELSE to_tsvector('simple', CASE
          WHEN nullif(btrim(${searchDocuments.fts_segmented}), '') IS NOT NULL
          THEN regexp_replace(btrim(${searchDocuments.fts_segmented}), '\\s+', ' ', 'g')
          ELSE message_fts_input(
            btrim(
              coalesce(${searchDocuments.title}, '') || ' ' ||
              coalesce(${searchDocuments.summary}, '') || ' ' ||
              coalesce(${searchDocuments.content}, '')
            )
          )
        END)
      END`,
    ),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
    updated_at: pgTimestamptz("updated_at")
      .notNull()
      .default(sql`now()`),
  },
  (t) => [
    index("idx_search_documents_resource_source").on(t.resource, t.source_id),
    index("idx_search_documents_world_primary").on(t.world_id, t.primary_component),
    index("idx_search_documents_conversation").on(t.conversation_id),
    index("idx_search_documents_search_fts").using("gin", t.search_fts),
    index("idx_search_documents_deleted_at").on(t.deleted_at),
    index("idx_search_documents_cluster_id").on(t.cluster_id),
  ],
);

export type SearchDocumentInsert = typeof searchDocuments.$inferInsert;
export type SearchDocumentSelect = typeof searchDocuments.$inferSelect;
