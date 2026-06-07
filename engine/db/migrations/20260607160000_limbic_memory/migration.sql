CREATE TABLE "limbic_memory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text NOT NULL,
	"kind" text NOT NULL,
	"valence" real,
	"arousal" real,
	"content" text NOT NULL,
	"intensity" real DEFAULT 0.5 NOT NULL,
	"source_segment" text,
	"semantic_memory_ids" text[] DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_semantic_memory_ids" ON "limbic_memory" USING gin ("semantic_memory_ids");--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_session_id" ON "limbic_memory" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_created_at" ON "limbic_memory" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_kind" ON "limbic_memory" USING btree ("kind");--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_intensity" ON "limbic_memory" USING btree ("intensity");--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_valence" ON "limbic_memory" USING btree ("valence");--> statement-breakpoint
CREATE INDEX "idx_limbic_memory_arousal" ON "limbic_memory" USING btree ("arousal");
