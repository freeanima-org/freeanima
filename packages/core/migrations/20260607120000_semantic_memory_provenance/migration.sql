ALTER TABLE "semantic_memory" ADD COLUMN "source_sessions" text[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD COLUMN "observed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD COLUMN "occurred_at" text;--> statement-breakpoint
ALTER TABLE "semantic_memory" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
UPDATE "semantic_memory" SET "observed_at" = "created" WHERE "observed_at" IS NULL;--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_source_sessions" ON "semantic_memory" USING gin ("source_sessions");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_status" ON "semantic_memory" USING btree ("status");
