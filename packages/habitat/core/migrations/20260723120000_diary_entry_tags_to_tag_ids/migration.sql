-- diary_entry.body.tags (string[]) → entities.tag_ids（指向同 world 的 tag entity）
-- 可重入：已无同名 tag 则复用；写完后剥离 body.tags

-- 1) 为日记字符串标签确保 tag entity（按 world + lower(title) 去重）
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
SELECT DISTINCT ON (d.world_id, lower(btrim(tag_elem.tag)))
  'content',
  d.world_id,
  ARRAY['tag']::text[],
  'tag',
  btrim(tag_elem.tag),
  '',
  '',
  jsonb_build_object('sort_order', 0, 'client_op_id', null),
  ARRAY[]::bigint[]
FROM "entities" d
CROSS JOIN LATERAL jsonb_array_elements_text(coalesce(d.body->'tags', '[]'::jsonb)) AS tag_elem(tag)
WHERE d.primary_component = 'diary_entry'
  AND nullif(btrim(tag_elem.tag), '') IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "entities" t
    WHERE t.world_id = d.world_id
      AND t.primary_component = 'tag'
      AND lower(t.title) = lower(btrim(tag_elem.tag))
  )
ORDER BY d.world_id, lower(btrim(tag_elem.tag)), btrim(tag_elem.tag);
--> statement-breakpoint

-- 2) 合并既有 tag_ids 与 body.tags 解析出的 id，并删除 body.tags
UPDATE "entities" d
SET
  "tag_ids" = COALESCE(
    (
      SELECT array_agg(DISTINCT x.tid ORDER BY x.tid)
      FROM (
        SELECT unnest(COALESCE(d.tag_ids, ARRAY[]::bigint[])) AS tid
        UNION ALL
        SELECT t.id
        FROM jsonb_array_elements_text(COALESCE(d.body->'tags', '[]'::jsonb)) AS tag_elem(tag)
        INNER JOIN "entities" t
          ON t.world_id = d.world_id
         AND t.primary_component = 'tag'
         AND lower(t.title) = lower(btrim(tag_elem.tag))
        WHERE nullif(btrim(tag_elem.tag), '') IS NOT NULL
      ) x
      WHERE x.tid IS NOT NULL
    ),
    ARRAY[]::bigint[]
  ),
  "body" = d.body - 'tags'
WHERE d.primary_component = 'diary_entry'
  AND d.body ? 'tags';
