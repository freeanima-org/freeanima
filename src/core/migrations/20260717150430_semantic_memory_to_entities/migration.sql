-- semantic_memory → entities (primary_component=semantic_memory)
-- 顺序：加列 → 迁数据 → remap 活引用/消息正文 → 改 memory_references → DROP 旧表

------------------------------------------------------------------
-- 1) entities 顶层 pinned / reference_count
------------------------------------------------------------------
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "reference_count" real DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_pinned" ON "entities" ("pinned");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_primary_reference_count" ON "entities" ("primary_component","reference_count" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_entities_primary_pinned_updated" ON "entities" ("primary_component","pinned","updated_at" DESC NULLS LAST);--> statement-breakpoint

------------------------------------------------------------------
-- 2) 数据迁移 + 活引用 remap + 消息正文替换
------------------------------------------------------------------
DO $$
DECLARE
  agent_world_id bigint;
  r RECORD;
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
    IF EXISTS (SELECT 1 FROM "semantic_memory" LIMIT 1) THEN
      RAISE EXCEPTION 'semantic_memory migration failed: no agent with default private world';
    END IF;
    -- 无数据时仍继续做 DDL 收尾（下方 DROP）
  ELSE
    CREATE TEMP TABLE semantic_memory_id_map (
      old_id text PRIMARY KEY,
      new_id bigint NOT NULL
    ) ON COMMIT DROP;

    INSERT INTO "entities" (
      "type", "world_id", "components", "primary_component",
      "title", "summary", "content", "body",
      "pinned", "reference_count",
      "fts_segmented", "search_embedding",
      "created_at", "updated_at"
    )
    SELECT
      'content',
      agent_world_id,
      ARRAY['semantic_memory']::text[],
      'semantic_memory',
      '',
      '',
      s.content,
      jsonb_build_object(
        'memory_kind', COALESCE(NULLIF(s.type, ''), 'world'),
        'status', COALESCE(NULLIF(s.status, ''), 'active'),
        'source_conversations', to_jsonb(COALESCE(s.source_conversations, ARRAY[]::text[])),
        'observed_at', CASE WHEN s.observed_at IS NULL THEN NULL ELSE to_jsonb(s.observed_at) END,
        'occurred_at', to_jsonb(s.occurred_at),
        'legacy_id', s.id
      ),
      COALESCE(s.pinned, false),
      COALESCE(s.reference_count, 0),
      s.fts_segmented,
      s.content_embedding,
      s.created_at,
      s.updated_at
    FROM "semantic_memory" s
    WHERE NOT EXISTS (
      SELECT 1 FROM "entities" e
      WHERE e.primary_component = 'semantic_memory'
        AND e.body->>'legacy_id' = s.id
    );

    INSERT INTO semantic_memory_id_map (old_id, new_id)
    SELECT e.body->>'legacy_id', e.id
    FROM "entities" e
    WHERE e.primary_component = 'semantic_memory'
      AND e.body->>'legacy_id' IS NOT NULL
    ON CONFLICT (old_id) DO NOTHING;

    -- memory_references: 先加可空 entity_id，填值后再改 NOT NULL / 删旧列
    ALTER TABLE "memory_references" ADD COLUMN IF NOT EXISTS "entity_id" bigint;

    UPDATE "memory_references" mr
    SET entity_id = m.new_id
    FROM semantic_memory_id_map m
    WHERE mr.semantic_memory_id = m.old_id
      AND mr.entity_id IS NULL;

    -- 无法映射的孤儿引用删除
    DELETE FROM "memory_references" WHERE entity_id IS NULL;

    -- limbic semantic_memory_ids remap（jsonb string array → number array）
    UPDATE "entities" e
    SET body = jsonb_set(
      e.body,
      '{semantic_memory_ids}',
      COALESCE((
        SELECT jsonb_agg(to_jsonb(m.new_id) ORDER BY ord)
        FROM jsonb_array_elements_text(COALESCE(e.body->'semantic_memory_ids', '[]'::jsonb))
          WITH ORDINALITY AS t(old_id, ord)
        LEFT JOIN semantic_memory_id_map m ON m.old_id = t.old_id
        WHERE m.new_id IS NOT NULL
      ), '[]'::jsonb)
    )
    WHERE e.components @> ARRAY['limbic']::text[]
      AND jsonb_typeof(e.body->'semantic_memory_ids') = 'array'
      AND jsonb_array_length(e.body->'semantic_memory_ids') > 0;

    -- narrative source_facts remap
    UPDATE "entities" e
    SET body = jsonb_set(
      e.body,
      '{source_facts}',
      COALESCE((
        SELECT jsonb_agg(to_jsonb(m.new_id) ORDER BY ord)
        FROM jsonb_array_elements_text(COALESCE(e.body->'source_facts', '[]'::jsonb))
          WITH ORDINALITY AS t(old_id, ord)
        LEFT JOIN semantic_memory_id_map m ON m.old_id = t.old_id
        WHERE m.new_id IS NOT NULL
      ), '[]'::jsonb)
    )
    WHERE e.components @> ARRAY['narrative']::text[]
      AND jsonb_typeof(e.body->'source_facts') = 'array'
      AND jsonb_array_length(e.body->'source_facts') > 0;

    -- semantic_ref: semantic_memory_id string → entity_id number
    UPDATE "entities" e
    SET body = (e.body - 'semantic_memory_id') || jsonb_build_object('entity_id', m.new_id)
    FROM semantic_memory_id_map m
    WHERE e.components @> ARRAY['semantic_ref']::text[]
      AND e.body->>'semantic_memory_id' = m.old_id;

    -- 历史消息正文 [[f-xxx]] → [[anima:id]]
    FOR r IN SELECT old_id, new_id FROM semantic_memory_id_map LOOP
      UPDATE "messages"
      SET payload = jsonb_set(
        payload,
        '{content}',
        to_jsonb(
          replace(
            payload->>'content',
            '[[' || r.old_id || ']]',
            '[[anima:' || r.new_id::text || ']]'
          )
        )
      )
      WHERE payload->>'role' IN ('user', 'assistant')
        AND payload->>'content' LIKE '%[[' || r.old_id || ']]%';
    END LOOP;
  END IF;
END $$;--> statement-breakpoint

------------------------------------------------------------------
-- 3) memory_references 列切换（无数据时也安全）
------------------------------------------------------------------
ALTER TABLE "memory_references" DROP CONSTRAINT IF EXISTS "memory_references_semantic_memory_id_semantic_memory_id_fkey";--> statement-breakpoint
DROP INDEX IF EXISTS "idx_memory_references_semantic_memory_id";--> statement-breakpoint
DROP INDEX IF EXISTS "memory_references_message_memory_uidx";--> statement-breakpoint

-- 确保 entity_id 存在（空库路径：无 DO 块内 ADD）
ALTER TABLE "memory_references" ADD COLUMN IF NOT EXISTS "entity_id" bigint;--> statement-breakpoint

-- 空表时 entity_id 仍可能全 NULL：填占位不可行，改为允许短暂可空再删无 entity 行后设 NOT NULL
DELETE FROM "memory_references" WHERE "entity_id" IS NULL;--> statement-breakpoint
ALTER TABLE "memory_references" ALTER COLUMN "entity_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "memory_references" DROP COLUMN IF EXISTS "semantic_memory_id";--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_memory_references_entity_id" ON "memory_references" ("entity_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "memory_references_message_entity_uidx" ON "memory_references" ("message_id","entity_id");--> statement-breakpoint
ALTER TABLE "memory_references" DROP CONSTRAINT IF EXISTS "memory_references_entity_id_entities_id_fkey";--> statement-breakpoint
ALTER TABLE "memory_references" ADD CONSTRAINT "memory_references_entity_id_entities_id_fkey" FOREIGN KEY ("entity_id") REFERENCES "entities"("id") ON DELETE CASCADE;--> statement-breakpoint

------------------------------------------------------------------
-- 4) DROP legacy semantic_memory
------------------------------------------------------------------
DROP TABLE IF EXISTS "semantic_memory";
