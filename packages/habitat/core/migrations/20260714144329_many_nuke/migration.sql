CREATE INDEX "idx_conversations_updated_at" ON "conversations" ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_conversations_archived_updated" ON "conversations" ("archived_at","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_status_reference_count" ON "semantic_memory" ("status","reference_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_status_pinned_updated" ON "semantic_memory" ("status","pinned","updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_entities_world_primary_component" ON "entities" ("world_id","primary_component");
--> statement-breakpoint
-- HNSW / gin_trgm / 表达式索引（drizzle-kit 难完整表达 opclass / partial / expression）
CREATE INDEX IF NOT EXISTS "idx_conversations_platform"
  ON "conversations" ((platform_info->>'platform'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_search_embedding_hnsw"
  ON "entities" USING hnsw ("search_embedding" vector_cosine_ops)
  WHERE "search_embedding" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_search_text_trgm"
  ON "entities" USING gin (
    (btrim(
      coalesce(title, '') || ' ' ||
      coalesce(summary, '') || ' ' ||
      coalesce(content, '')
    )) gin_trgm_ops
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_task_item_list_status"
  ON "entities" ((body->>'list_id'), (body->>'status'))
  WHERE primary_component = 'task_item';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_limbic_memory_embedding_hnsw"
  ON "limbic_memory" USING hnsw ("content_embedding" vector_cosine_ops)
  WHERE "content_embedding" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_limbic_memory_content_trgm"
  ON "limbic_memory" USING gin ("content" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_autobiographical_memory_embedding_hnsw"
  ON "autobiographical_memory" USING hnsw ("content_embedding" vector_cosine_ops)
  WHERE "content_embedding" IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_autobiographical_memory_content_trgm"
  ON "autobiographical_memory" USING gin ("content" gin_trgm_ops);
