CREATE TABLE "auto_llm_runs" (
	"id" text PRIMARY KEY,
	"run_name" text NOT NULL,
	"run_kind" text NOT NULL,
	"input_summary" text DEFAULT '' NOT NULL,
	"output" text DEFAULT '' NOT NULL,
	"status" text NOT NULL,
	"duration_ms" integer NOT NULL,
	"error" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_auto_llm_runs_kind_finished" ON "auto_llm_runs" ("run_kind","finished_at");--> statement-breakpoint
CREATE INDEX "idx_auto_llm_runs_name_finished" ON "auto_llm_runs" ("run_name","finished_at");