ALTER INDEX "idx_tasks_list" RENAME TO "idx_task_list";--> statement-breakpoint
ALTER TABLE "autobiographical_memory" ADD COLUMN "fts_segmented" text;--> statement-breakpoint
ALTER TABLE "autobiographical_memory" ADD COLUMN "content_embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "autobiographical_memory" ADD COLUMN "content_fts" tsvector GENERATED ALWAYS AS (to_tsvector('simple', CASE
          WHEN nullif(btrim("autobiographical_memory"."fts_segmented"), '') IS NOT NULL
          THEN regexp_replace(btrim("autobiographical_memory"."fts_segmented"), '\s+', ' ', 'g')
          ELSE message_fts_input(
            btrim("autobiographical_memory"."title") || E'\n' || btrim("autobiographical_memory"."content")
          )
        END)) STORED;--> statement-breakpoint
ALTER TABLE "limbic_memory" ADD COLUMN "fts_segmented" text;--> statement-breakpoint
ALTER TABLE "limbic_memory" ADD COLUMN "content_embedding" vector(1024);--> statement-breakpoint
ALTER TABLE "limbic_memory" ADD COLUMN "content_fts" tsvector GENERATED ALWAYS AS (to_tsvector('simple', CASE
          WHEN nullif(btrim("limbic_memory"."fts_segmented"), '') IS NOT NULL
          THEN regexp_replace(btrim("limbic_memory"."fts_segmented"), '\s+', ' ', 'g')
          ELSE message_fts_input("limbic_memory"."content")
        END)) STORED;--> statement-breakpoint
CREATE INDEX "idx_autobiographical_memory_fts" ON "autobiographical_memory" USING gin ("content_fts");--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_fts" ON "limbic_memory" USING gin ("content_fts");