-- vault_item / email_* / task_item body.tags (string[]) → entities.tag_ids
-- 可重入：已有同名 tag 则复用；写完后剥离 body.tags

-- 1) 为字符串标签确保 tag entity（按 world + lower(title) 去重）
INSERT INTO "entities" (
  "type",
  "world_id",
  "components",
  "primary_component",
  "title",
  "summary",
  "content",
  "body",
  "tag_ids"
)
SELECT DISTINCT ON (e.world_id, lower(btrim(tag_elem.tag)))
  'content',
  e.world_id,
  ARRAY['tag']::text[],
  'tag',
  btrim(tag_elem.tag),
  '',
  '',
  jsonb_build_object('sort_order', 0, 'client_op_id', null),
  ARRAY[]::bigint[]
FROM "entities" e
CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(e.body->'tags', '[]'::jsonb)) AS tag_elem(tag)
WHERE e.primary_component IN (
    'vault_item',
    'email_account',
    'email_thread',
    'email_message',
    'task_item'
  )
  AND nullif(btrim(tag_elem.tag), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "entities" t
    WHERE t.world_id = e.world_id
      AND t.primary_component = 'tag'
      AND lower(t.title) = lower(btrim(tag_elem.tag))
  )
ORDER BY e.world_id, lower(btrim(tag_elem.tag)), btrim(tag_elem.tag);
--> statement-breakpoint

-- 2) 合并既有 tag_ids 与 body.tags 解析出的 id，并删除 body.tags
UPDATE "entities" e
SET
  "tag_ids" = COALESCE(
    (
      SELECT array_agg(DISTINCT x.tid ORDER BY x.tid)
      FROM (
        SELECT unnest(COALESCE(e.tag_ids, ARRAY[]::bigint[])) AS tid
        UNION ALL
        SELECT t.id
        FROM jsonb_array_elements_text(COALESCE(e.body->'tags', '[]'::jsonb)) AS tag_elem(tag)
        INNER JOIN "entities" t
          ON t.world_id = e.world_id
         AND t.primary_component = 'tag'
         AND lower(t.title) = lower(btrim(tag_elem.tag))
        WHERE nullif(btrim(tag_elem.tag), '') IS NOT NULL
      ) x
      WHERE x.tid IS NOT NULL
    ),
    ARRAY[]::bigint[]
  ),
  "body" = e.body - 'tags'
WHERE e.primary_component IN (
    'vault_item',
    'email_account',
    'email_thread',
    'email_message',
    'task_item'
  )
  AND e.body ? 'tags';
