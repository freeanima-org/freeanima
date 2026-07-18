ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "tag_ids" bigint[] DEFAULT '{}'::bigint[] NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_tag_ids" ON "entities" USING gin ("tag_ids");
