ALTER TABLE "entities" ADD COLUMN "deleted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "entities" ALTER COLUMN "primary_component" DROP NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_entities_deleted_at" ON "entities" ("deleted_at");--> statement-breakpoint
-- 软删行 purge 扫描；存活行热路径用 deleted_at IS NULL
CREATE INDEX IF NOT EXISTS "idx_entities_deleted_at_not_null" ON "entities" ("deleted_at") WHERE "deleted_at" IS NOT NULL;