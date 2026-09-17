ALTER TABLE "auto_llm_runs" ADD COLUMN "subject_id" integer;--> statement-breakpoint
CREATE INDEX "idx_auto_llm_runs_subject_finished" ON "auto_llm_runs" ("subject_id","finished_at");
