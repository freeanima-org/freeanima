CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_semantic_memory_content_trgm" ON "semantic_memory" USING gin ("content" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_messages_content_trgm" ON "messages" USING gin ((payload->>'content') gin_trgm_ops) WHERE "content_fts" IS NOT NULL;
