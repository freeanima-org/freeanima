CREATE TABLE "memory_references" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"message_id" text NOT NULL,
	"semantic_memory_id" text NOT NULL,
	"session_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD COLUMN "reference_count" real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_memory_references_semantic_memory_id" ON "memory_references" ("semantic_memory_id");--> statement-breakpoint
CREATE INDEX "idx_memory_references_session_id" ON "memory_references" ("session_id");--> statement-breakpoint
CREATE INDEX "idx_memory_references_created_at" ON "memory_references" ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "memory_references_message_memory_uidx" ON "memory_references" ("message_id","semantic_memory_id");--> statement-breakpoint
ALTER TABLE "memory_references" ADD CONSTRAINT "memory_references_message_id_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memory_references" ADD CONSTRAINT "memory_references_semantic_memory_id_semantic_memory_id_fkey" FOREIGN KEY ("semantic_memory_id") REFERENCES "semantic_memory"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memory_references" ADD CONSTRAINT "memory_references_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE;