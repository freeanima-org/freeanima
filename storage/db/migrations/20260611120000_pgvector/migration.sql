ALTER TABLE "messages" ADD COLUMN "content_embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD COLUMN "content_embedding" vector(1024);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_semantic_memory_embedding_hnsw" ON "semantic_memory" USING hnsw ("content_embedding" vector_cosine_ops) WHERE "content_embedding" IS NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_embedding_hnsw" ON "messages" USING hnsw ("content_embedding" vector_cosine_ops) WHERE "content_embedding" IS NOT NULL;
