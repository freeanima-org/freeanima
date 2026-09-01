ALTER TABLE "entities" ADD COLUMN "client_op_id" text;--> statement-breakpoint
-- 从 body 回填幂等键，再剥离 body 字段；世界内非空唯一
UPDATE "entities"
SET "client_op_id" = "body"->>'client_op_id'
WHERE "body" ? 'client_op_id'
  AND nullif(btrim("body"->>'client_op_id'), '') IS NOT NULL
  AND "client_op_id" IS NULL;--> statement-breakpoint
UPDATE "entities"
SET "body" = "body" - 'client_op_id'
WHERE "body" ? 'client_op_id';--> statement-breakpoint
CREATE UNIQUE INDEX "idx_entities_world_client_op_id"
  ON "entities" ("world_id", "client_op_id")
  WHERE "client_op_id" IS NOT NULL;
