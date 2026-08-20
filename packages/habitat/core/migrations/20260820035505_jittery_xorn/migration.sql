-- self_blocks → entities (primary_component=self_block)
-- 顺序：迁数据 → 唯一索引 → DROP 旧表

------------------------------------------------------------------
-- 1) 数据迁移（agent 默认私有 world）
------------------------------------------------------------------
DO $$
DECLARE
  agent_world_id bigint;
BEGIN
  SELECT COALESCE(
    NULLIF(a.body->>'default_private_world_id', '')::bigint,
    (
      SELECT w.id FROM "entities" w
      WHERE w.type = 'world'
        AND w.primary_component = 'world_config'
        AND (w.body->>'default_private')::boolean IS TRUE
        AND (w.body->>'owner_subject_id')::bigint = a.id
      ORDER BY w.id ASC
      LIMIT 1
    )
  ) INTO agent_world_id
  FROM "entities" a
  WHERE a.type = 'agent'
  ORDER BY a.id ASC
  LIMIT 1;

  IF agent_world_id IS NULL THEN
    IF EXISTS (SELECT 1 FROM "self_blocks" LIMIT 1) THEN
      RAISE EXCEPTION 'self_blocks migration failed: no agent with default private world';
    END IF;
  ELSE
    INSERT INTO "entities" (
      "type", "world_id", "components", "primary_component",
      "title", "summary", "content", "body",
      "pinned", "reference_count", "tag_ids", "revisions",
      "created_at", "updated_at"
    )
    SELECT
      'content',
      agent_world_id,
      ARRAY['self_block']::text[],
      'self_block',
      'self ' || s.block_key,
      left(COALESCE(s.content, ''), 200),
      COALESCE(s.content, ''),
      jsonb_build_object(
        'block_key', s.block_key,
        'locked', COALESCE(s.locked, false),
        'version', COALESCE(s.version, 1),
        'updated_by', to_jsonb(s.updated_by)
      ),
      false,
      0,
      ARRAY[]::bigint[],
      '[]'::jsonb,
      s.created_at,
      s.updated_at
    FROM "self_blocks" s
    WHERE NOT EXISTS (
      SELECT 1 FROM "entities" e
      WHERE e.primary_component = 'self_block'
        AND e.world_id = agent_world_id
        AND e.deleted_at IS NULL
        AND e.body->>'block_key' = s.block_key
    );
  END IF;
END $$;
--> statement-breakpoint

------------------------------------------------------------------
-- 2) 唯一索引（per world + block_key；软删行不占唯一）
------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_self_block_world_key"
ON "entities" (
  "world_id",
  (body->>'block_key')
)
WHERE "primary_component" = 'self_block' AND "deleted_at" IS NULL;
--> statement-breakpoint

------------------------------------------------------------------
-- 3) DROP 旧表
------------------------------------------------------------------
DROP TABLE "self_blocks";
