ALTER TABLE "auto_llm_runs" ADD COLUMN IF NOT EXISTS "max_turns" integer DEFAULT 50 NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_llm_runs" ADD COLUMN IF NOT EXISTS "max_duration_ms" integer;
