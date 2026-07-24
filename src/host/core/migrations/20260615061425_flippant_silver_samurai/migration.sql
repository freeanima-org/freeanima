CREATE TABLE "pipeline_step_run" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "pipeline_step_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"pipeline_id" text NOT NULL,
	"run_id" text NOT NULL,
	"step_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"day" text NOT NULL,
	"trigger" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone NOT NULL,
	"output" jsonb,
	"error" text,
	"skipped_reason" text
);
--> statement-breakpoint
CREATE INDEX "idx_pipeline_step_run_pipeline_finished" ON "pipeline_step_run" ("pipeline_id","finished_at");--> statement-breakpoint
CREATE INDEX "idx_pipeline_step_run_run_step_attempt" ON "pipeline_step_run" ("run_id","step_id","attempt");--> statement-breakpoint
CREATE INDEX "idx_pipeline_step_run_step_finished" ON "pipeline_step_run" ("step_id","finished_at");