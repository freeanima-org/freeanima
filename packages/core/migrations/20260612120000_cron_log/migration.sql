CREATE TABLE "cron_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"job_id" text NOT NULL,
	"run_count" integer NOT NULL,
	"ok" boolean NOT NULL,
	"finished_at" timestamp with time zone DEFAULT now() NOT NULL,
	"output" jsonb,
	"output_text" text,
	"error" text,
	CONSTRAINT "cron_log_job_id_run_count_unique" UNIQUE("job_id","run_count")
);
--> statement-breakpoint
ALTER TABLE "cron_log" ADD CONSTRAINT "cron_log_job_id_cron_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "cron_jobs"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "idx_cron_log_job_finished" ON "cron_log" USING btree ("job_id","finished_at" DESC);
