-- Backfill legacy tasks → entity task_item (default list id=2) before drop.
-- Must stay in this migration file: Hub startup only runs Drizzle migrations, not scripts/.
INSERT INTO "entities" ("type", "world_id", "owner_id", "components", "primary_component", "title", "summary", "content", "body")
SELECT
  'content',
  1,
  NULL,
  ARRAY['task_item']::text[],
  'task_item',
  COALESCE(NULLIF(btrim("title"), ''), '(无标题)'),
  '',
  COALESCE("description", ''),
  jsonb_build_object(
    'status', CASE WHEN "status" = 'completed' THEN 'completed' ELSE 'pending' END,
    'priority', CASE WHEN "priority" IN ('high', 'medium', 'low', 'none') THEN "priority" ELSE 'none' END,
    'list_id', 2,
    'sort_order', 0,
    'tags', jsonb_build_array('legacy:' || "id"),
    'completed_at', "completed_at",
    'due_at', "due_at"
  )
FROM "tasks"
WHERE "status" <> 'cancelled';--> statement-breakpoint
DROP TABLE "tasks";
