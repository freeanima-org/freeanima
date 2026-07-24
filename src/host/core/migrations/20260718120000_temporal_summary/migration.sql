ALTER TABLE "conversations" ADD COLUMN "temporal_day" jsonb;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_temporal_summary_global_window_period"
ON "entities" ((("body" ->> 'window')), (("body" ->> 'period_start')))
WHERE "primary_component" = 'temporal_summary';
