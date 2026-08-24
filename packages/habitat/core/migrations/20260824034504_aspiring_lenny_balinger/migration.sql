CREATE TABLE "workflow_runs" (
	"id" text PRIMARY KEY,
	"workflow_entity_id" bigint,
	"name" text,
	"input" jsonb DEFAULT '{}' NOT NULL,
	"output" jsonb,
	"status" text NOT NULL,
	"error" text,
	"subject_id" bigint,
	"world_id" bigint,
	"created_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_entity_created" ON "workflow_runs" ("workflow_entity_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_name_created" ON "workflow_runs" ("name","created_at");--> statement-breakpoint
CREATE INDEX "idx_workflow_runs_world_created" ON "workflow_runs" ("world_id","created_at");--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_workflow_entity_id_entities_id_fkey" FOREIGN KEY ("workflow_entity_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_subject_id_entities_id_fkey" FOREIGN KEY ("subject_id") REFERENCES "entities"("id");--> statement-breakpoint
ALTER TABLE "workflow_runs" ADD CONSTRAINT "workflow_runs_world_id_entities_id_fkey" FOREIGN KEY ("world_id") REFERENCES "entities"("id");