ALTER TABLE "semantic_memory" ADD COLUMN "fts_segmented" text;--> statement-breakpoint
ALTER TABLE "semantic_memory" DROP COLUMN "content_fts";--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD COLUMN "content_fts" tsvector GENERATED ALWAYS AS (
  to_tsvector('simple', CASE
    WHEN nullif(btrim("fts_segmented"), '') IS NOT NULL
    THEN regexp_replace(btrim("fts_segmented"), '\s+', ' ', 'g')
    ELSE message_fts_input("content")
  END)
) STORED;--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_fts" ON "semantic_memory" USING gin ("content_fts");--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "fts_segmented" text;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "content_fts";--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "content_fts" tsvector GENERATED ALWAYS AS (
  CASE
    WHEN (payload->>'role') IN ('user', 'assistant')
      AND length(btrim(payload->>'content')) > 0
    THEN to_tsvector('simple', CASE
      WHEN nullif(btrim("fts_segmented"), '') IS NOT NULL
      THEN regexp_replace(btrim("fts_segmented"), '\s+', ' ', 'g')
      ELSE message_fts_input(payload->>'content')
    END)
    ELSE NULL
  END
) STORED;--> statement-breakpoint
CREATE INDEX "messages_content_fts_gin" ON "messages" USING gin ("content_fts");
