ALTER TABLE "search_documents" ADD COLUMN IF NOT EXISTS "cluster_id" integer;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_search_documents_cluster_id" ON "search_documents" ("cluster_id");
