CREATE TABLE "auto_llm_messages" (
	"id" text PRIMARY KEY,
	"run_id" text NOT NULL,
	"pos" bigint NOT NULL,
	"payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "auto_llm_messages_run_id_pos_uidx" ON "auto_llm_messages" ("run_id","pos");--> statement-breakpoint
CREATE INDEX "idx_auto_llm_messages_run_id" ON "auto_llm_messages" ("run_id");--> statement-breakpoint
ALTER TABLE "auto_llm_messages" ADD CONSTRAINT "auto_llm_messages_run_id_auto_llm_runs_id_fkey" FOREIGN KEY ("run_id") REFERENCES "auto_llm_runs"("id") ON DELETE cascade ON UPDATE no action;
