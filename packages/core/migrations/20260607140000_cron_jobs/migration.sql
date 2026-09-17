CREATE TABLE "cron_jobs" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"schedule" text NOT NULL,
	"prompt" text DEFAULT '' NOT NULL,
	"skills" text[] DEFAULT '{}' NOT NULL,
	"script" text,
	"no_agent" boolean DEFAULT false NOT NULL,
	"enabled_toolsets" text[],
	"model_provider" text,
	"model_name" text,
	"workdir" text,
	"context_from" text[] DEFAULT '{}' NOT NULL,
	"deliver" text DEFAULT 'local' NOT NULL,
	"timeout_sec" integer DEFAULT 300 NOT NULL,
	"builtin" boolean DEFAULT false NOT NULL,
	"repeat" integer,
	"run_count" integer DEFAULT 0 NOT NULL,
	"paused" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_output_ref" text
);
--> statement-breakpoint
CREATE INDEX "idx_cron_jobs_paused" ON "cron_jobs" USING btree ("paused");
