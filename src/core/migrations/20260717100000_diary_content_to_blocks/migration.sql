-- diary_entry 单正文 → 首条 text content_block；容器 content 清空（一次性，可重入）
INSERT INTO "entities" (
  "type",
  "world_id",
  "components",
  "primary_component",
  "title",
  "summary",
  "content",
  "body",
  "created_at",
  "updated_at"
)
SELECT
  'content',
  d.world_id,
  ARRAY['content_block']::text[],
  'content_block',
  '',
  '',
  d.content,
  jsonb_build_object(
    'block_type', 'text',
    'parent_id', d.id,
    'sort_order', 0,
    'url', null,
    'client_op_id', null
  ),
  d.created_at,
  d.updated_at
FROM "entities" d
WHERE d.primary_component = 'diary_entry'
  AND nullif(btrim(d.content), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "entities" b
    WHERE b.primary_component = 'content_block'
      AND (b.body->>'parent_id')::bigint = d.id
  );
--> statement-breakpoint
UPDATE "entities" d
SET
  "content" = '',
  "fts_segmented" = NULL
WHERE d.primary_component = 'diary_entry'
  AND nullif(btrim(d.content), '') IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "entities" b
    WHERE b.primary_component = 'content_block'
      AND (b.body->>'parent_id')::bigint = d.id
  );
