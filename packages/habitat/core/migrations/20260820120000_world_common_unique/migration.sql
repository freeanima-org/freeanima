-- 全库至多一个 Commons（world_config.common=true）；保留最小 id，其余降级
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id ASC) AS rn
  FROM entities
  WHERE primary_component = 'world_config'
    AND (body->>'common') = 'true'
    AND deleted_at IS NULL
)
UPDATE entities AS e
SET
  body = jsonb_set(COALESCE(e.body, '{}'::jsonb), '{common}', 'false'::jsonb, true),
  title = CASE WHEN e.title = 'Commons' THEN 'Commons（已退役）' ELSE e.title END,
  updated_at = now()
FROM ranked AS r
WHERE e.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_world_common"
ON "entities" ((body->>'common'))
WHERE primary_component = 'world_config'
  AND (body->>'common') = 'true'
  AND deleted_at IS NULL;
