CREATE TABLE "search_documents" (
	"doc_key" text PRIMARY KEY,
	"resource" text NOT NULL,
	"source_id" text NOT NULL,
	"world_id" bigint,
	"primary_component" text,
	"conversation_id" text,
	"message_role" text,
	"deleted_at" timestamp with time zone,
	"title" text DEFAULT '' NOT NULL,
	"summary" text DEFAULT '' NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"fts_segmented" text,
	"embedding" vector(1024),
	"search_fts" tsvector GENERATED ALWAYS AS (CASE
        WHEN "search_documents"."resource" = 'message'
          AND (
            "search_documents"."message_role" IS NULL
            OR "search_documents"."message_role" NOT IN ('user', 'assistant')
            OR length(btrim("search_documents"."content")) = 0
          )
        THEN NULL
        ELSE to_tsvector('simple', CASE
          WHEN nullif(btrim("search_documents"."fts_segmented"), '') IS NOT NULL
          THEN regexp_replace(btrim("search_documents"."fts_segmented"), '\s+', ' ', 'g')
          ELSE message_fts_input(
            btrim(
              coalesce("search_documents"."title", '') || ' ' ||
              coalesce("search_documents"."summary", '') || ' ' ||
              coalesce("search_documents"."content", '')
            )
          )
        END)
      END) STORED,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_search_documents_resource_source" ON "search_documents" ("resource","source_id");--> statement-breakpoint
CREATE INDEX "idx_search_documents_world_primary" ON "search_documents" ("world_id","primary_component");--> statement-breakpoint
CREATE INDEX "idx_search_documents_conversation" ON "search_documents" ("conversation_id");--> statement-breakpoint
CREATE INDEX "idx_search_documents_search_fts" ON "search_documents" USING gin ("search_fts");--> statement-breakpoint
CREATE INDEX "idx_search_documents_deleted_at" ON "search_documents" ("deleted_at");--> statement-breakpoint
-- Backfill entity search rows (copy segmented + embedding before dropping business columns)
INSERT INTO "search_documents" (
  "doc_key", "resource", "source_id", "world_id", "primary_component", "deleted_at",
  "title", "summary", "content", "fts_segmented", "embedding", "created_at", "updated_at"
)
SELECT
  'ent:' || e.id::text,
  'entity',
  e.id::text,
  e.world_id,
  e.primary_component,
  e.deleted_at,
  coalesce(e.title, ''),
  coalesce(e.summary, ''),
  coalesce(e.content, ''),
  e.fts_segmented,
  e.search_embedding,
  coalesce(e.created_at, now()),
  coalesce(e.updated_at, now())
FROM "entities" e
ON CONFLICT ("doc_key") DO NOTHING;
--> statement-breakpoint
-- Backfill message search rows (only roles that had content_fts)
INSERT INTO "search_documents" (
  "doc_key", "resource", "source_id", "conversation_id", "message_role",
  "title", "summary", "content", "fts_segmented", "embedding", "created_at", "updated_at"
)
SELECT
  'msg:' || m.id,
  'message',
  m.id,
  m.conversation_id,
  m.payload->>'role',
  '',
  '',
  coalesce(m.payload->>'content', ''),
  m.fts_segmented,
  m.content_embedding,
  now(),
  now()
FROM "messages" m
WHERE (m.payload->>'role') IN ('user', 'assistant')
  AND length(btrim(coalesce(m.payload->>'content', ''))) > 0
ON CONFLICT ("doc_key") DO NOTHING;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_search_documents_embedding_hnsw"
  ON "search_documents" USING hnsw ("embedding" vector_cosine_ops)
  WHERE "embedding" IS NOT NULL;
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_messages_embedding_hnsw";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_entities_search_embedding_hnsw";--> statement-breakpoint
DROP INDEX IF EXISTS "messages_content_fts_gin";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_entities_search_fts";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "content_fts";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "fts_segmented";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "content_embedding";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "search_fts";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "fts_segmented";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "search_embedding";
