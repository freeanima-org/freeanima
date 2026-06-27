ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "fts_segmented" text;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "search_embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "search_fts" tsvector GENERATED ALWAYS AS (to_tsvector('simple', CASE
        WHEN nullif(btrim("entities"."fts_segmented"), '') IS NOT NULL
        THEN regexp_replace(btrim("entities"."fts_segmented"), '\s+', ' ', 'g')
        ELSE message_fts_input(
          btrim(
            coalesce("entities"."title", '') || ' ' ||
            coalesce("entities"."summary", '') || ' ' ||
            coalesce("entities"."content", '')
          )
        )
      END)) STORED;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_search_fts" ON "entities" USING gin ("search_fts");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_task_item_list_status"
  ON "entities" ((body->>'list_id'), (body->>'status'))
  WHERE primary_component = 'task_item';
