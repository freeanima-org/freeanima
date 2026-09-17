ALTER TABLE "entities" ADD COLUMN "title" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "summary" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN "content" text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE "entities" SET "title" = COALESCE("body"->>'name', '我的任务'), "summary" = COALESCE("body"->>'description', '') WHERE "primary_component" = 'world_config';--> statement-breakpoint
UPDATE "entities" SET "title" = COALESCE(NULLIF("body"->>'name', ''), "title"), "body" = "body" - 'name' WHERE "primary_component" = 'task_list' AND "body" ? 'name';--> statement-breakpoint
UPDATE "entities" SET "title" = COALESCE(NULLIF("body"->>'title', ''), "title"), "content" = COALESCE("body"->>'note', ''), "body" = "body" - 'title' - 'note' WHERE "primary_component" = 'task_item';--> statement-breakpoint
INSERT INTO "entities" ("id", "type", "world_id", "owner_id", "components", "primary_component", "title", "summary", "content", "body")
OVERRIDING SYSTEM VALUE
SELECT 2, 'content', 1, NULL, ARRAY['task_list']::text[], 'task_list', '收件箱', '', '', '{"sort_order":0,"is_default":true,"closed":false}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM "entities" WHERE "id" = 2);--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('entities', 'id'), GREATEST((SELECT MAX(id) FROM entities), 2));