CREATE TABLE "tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" text DEFAULT 'none' NOT NULL,
	"due_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"source_session_id" text
);
--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_source_session_id_sessions_id_fk" FOREIGN KEY ("source_session_id") REFERENCES "sessions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
--> statement-breakpoint
CREATE INDEX "idx_tasks_status" ON "tasks" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "idx_tasks_list" ON "tasks" USING btree ("status","priority","created_at");
