-- limbic_memory / autobiographical_memory / dream_entry → diary content_block + semantic tags
-- 顺序：limbic → autobiographical → dream（dream 引用 limbic legacy_id remap）

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
    -- 无 agent 时仅在有待迁数据时失败
    IF EXISTS (SELECT 1 FROM "limbic_memory" LIMIT 1)
       OR EXISTS (SELECT 1 FROM "autobiographical_memory" LIMIT 1)
       OR EXISTS (SELECT 1 FROM "entities" WHERE primary_component = 'dream_entry' LIMIT 1) THEN
      RAISE EXCEPTION 'memory bricks backfill failed: no agent with default private world';
    END IF;
    RETURN;
  END IF;

  ------------------------------------------------------------------
  -- 1) limbic_memory → content_block + limbic
  ------------------------------------------------------------------
  -- ensure diaries for limbic days (CST)
  INSERT INTO "entities" (
    "type", "world_id", "components", "primary_component",
    "title", "summary", "content", "body", "created_at", "updated_at"
  )
  SELECT DISTINCT ON (day_key)
    'content',
    agent_world_id,
    ARRAY['diary_entry']::text[],
    'diary_entry',
    day_key,
    '',
    '',
    jsonb_build_object(
      'entry_at', day_key || 'T12:00:00+08:00',
      'tags', '[]'::jsonb,
      'client_op_id', null
    ),
    now(),
    now()
  FROM (
    SELECT (l.created_at AT TIME ZONE 'Asia/Shanghai')::date::text AS day_key
    FROM "limbic_memory" l
  ) days
  WHERE NOT EXISTS (
    SELECT 1 FROM "entities" d
    WHERE d.world_id = agent_world_id
      AND d.primary_component = 'diary_entry'
      AND left(d.body->>'entry_at', 10) = days.day_key
  )
  ORDER BY day_key;

  INSERT INTO "entities" (
    "type", "world_id", "components", "primary_component",
    "title", "summary", "content", "body", "created_at", "updated_at"
  )
  SELECT
    'content',
    agent_world_id,
    ARRAY['content_block', 'limbic']::text[],
    'content_block',
    '',
    '',
    l.content,
    jsonb_build_object(
      'block_type', 'text',
      'parent_id', d.id,
      'sort_order', 1000 + (row_number() OVER (PARTITION BY d.id ORDER BY l.created_at, l.id))::int,
      'url', null,
      'client_op_id', null,
      'valence', COALESCE(l.valence, 0),
      'arousal', COALESCE(l.arousal, 0),
      'intensity', COALESCE(l.intensity, 0.5),
      'kind', l.kind,
      'conversation_id', l.conversation_id,
      'source_segment', l.source_segment,
      'semantic_memory_ids', to_jsonb(COALESCE(l.semantic_memory_ids, ARRAY[]::text[])),
      'legacy_id', l.id::text
    ),
    l.created_at,
    l.created_at
  FROM "limbic_memory" l
  JOIN "entities" d
    ON d.world_id = agent_world_id
   AND d.primary_component = 'diary_entry'
   AND left(d.body->>'entry_at', 10) = (l.created_at AT TIME ZONE 'Asia/Shanghai')::date::text
  WHERE NOT EXISTS (
    SELECT 1 FROM "entities" b
    WHERE b.world_id = agent_world_id
      AND b.primary_component = 'content_block'
      AND b.components @> ARRAY['limbic']::text[]
      AND b.body->>'legacy_id' = l.id::text
  );

  ------------------------------------------------------------------
  -- 2) autobiographical_memory → content_block + narrative
  ------------------------------------------------------------------
  INSERT INTO "entities" (
    "type", "world_id", "components", "primary_component",
    "title", "summary", "content", "body", "created_at", "updated_at"
  )
  SELECT DISTINCT ON (day_key)
    'content',
    agent_world_id,
    ARRAY['diary_entry']::text[],
    'diary_entry',
    day_key,
    '',
    '',
    jsonb_build_object(
      'entry_at', day_key || 'T12:00:00+08:00',
      'tags', '[]'::jsonb,
      'client_op_id', null
    ),
    now(),
    now()
  FROM (
    SELECT
      CASE
        WHEN a.period_end ~ '^\d{4}-\d{2}-\d{2}' THEN left(a.period_end, 10)
        WHEN a.period_end ~ '^\d{4}-\d{2}$' THEN
          to_char(
            (date_trunc('month', (a.period_end || '-01')::date) + interval '1 month - 1 day')::date,
            'YYYY-MM-DD'
          )
        ELSE (a.created_at AT TIME ZONE 'Asia/Shanghai')::date::text
      END AS day_key
    FROM "autobiographical_memory" a
  ) days
  WHERE NOT EXISTS (
    SELECT 1 FROM "entities" d
    WHERE d.world_id = agent_world_id
      AND d.primary_component = 'diary_entry'
      AND left(d.body->>'entry_at', 10) = days.day_key
  )
  ORDER BY day_key;

  INSERT INTO "entities" (
    "type", "world_id", "components", "primary_component",
    "title", "summary", "content", "body", "created_at", "updated_at"
  )
  SELECT
    'content',
    agent_world_id,
    ARRAY['content_block', 'narrative']::text[],
    'content_block',
    a.title,
    '',
    a.content,
    jsonb_build_object(
      'block_type', 'text',
      'parent_id', d.id,
      'sort_order', 2000 + (row_number() OVER (PARTITION BY d.id ORDER BY a.created_at, a.id))::int,
      'url', null,
      'client_op_id', null,
      'significance', COALESCE(NULLIF(a.significance, ''), 'normal'),
      'period_start', a.period_start,
      'period_end', a.period_end,
      'source_facts', to_jsonb(COALESCE(a.source_facts, ARRAY[]::text[])),
      'source_conversations', to_jsonb(COALESCE(a.source_conversations, ARRAY[]::text[])),
      'status', COALESCE(NULLIF(a.status, ''), 'active'),
      'legacy_id', a.id
    ),
    a.created_at,
    a.updated_at
  FROM "autobiographical_memory" a
  JOIN "entities" d
    ON d.world_id = agent_world_id
   AND d.primary_component = 'diary_entry'
   AND left(d.body->>'entry_at', 10) = (
     CASE
       WHEN a.period_end ~ '^\d{4}-\d{2}-\d{2}' THEN left(a.period_end, 10)
       WHEN a.period_end ~ '^\d{4}-\d{2}$' THEN
         to_char(
           (date_trunc('month', (a.period_end || '-01')::date) + interval '1 month - 1 day')::date,
           'YYYY-MM-DD'
         )
       ELSE (a.created_at AT TIME ZONE 'Asia/Shanghai')::date::text
     END
   )
  WHERE NOT EXISTS (
    SELECT 1 FROM "entities" b
    WHERE b.world_id = agent_world_id
      AND b.primary_component = 'content_block'
      AND b.components @> ARRAY['narrative']::text[]
      AND b.body->>'legacy_id' = a.id
  );

  ------------------------------------------------------------------
  -- 3) dream_entry → content_block + dream（挂同日 diary）
  ------------------------------------------------------------------
  INSERT INTO "entities" (
    "type", "world_id", "components", "primary_component",
    "title", "summary", "content", "body", "created_at", "updated_at"
  )
  SELECT DISTINCT ON (day_key)
    'content',
    de.world_id,
    ARRAY['diary_entry']::text[],
    'diary_entry',
    day_key,
    '',
    '',
    jsonb_build_object(
      'entry_at', day_key || 'T12:00:00+08:00',
      'tags', '[]'::jsonb,
      'client_op_id', null
    ),
    now(),
    now()
  FROM (
    SELECT e.world_id, e.body->>'dream_day' AS day_key
    FROM "entities" e
    WHERE e.primary_component = 'dream_entry'
      AND nullif(btrim(e.body->>'dream_day'), '') IS NOT NULL
  ) de
  WHERE NOT EXISTS (
    SELECT 1 FROM "entities" d
    WHERE d.world_id = de.world_id
      AND d.primary_component = 'diary_entry'
      AND left(d.body->>'entry_at', 10) = de.day_key
  )
  ORDER BY day_key;

  INSERT INTO "entities" (
    "type", "world_id", "components", "primary_component",
    "title", "summary", "content", "body", "created_at", "updated_at"
  )
  SELECT
    'content',
    de.world_id,
    ARRAY['content_block', 'dream']::text[],
    'content_block',
    COALESCE(de.title, de.body->>'dream_day'),
    '',
    de.content,
    jsonb_build_object(
      'block_type', 'text',
      'parent_id', d.id,
      'sort_order', 3000,
      'url', null,
      'client_op_id', null,
      'source_limbic_ids', COALESCE((
        SELECT jsonb_agg(lb.id::text ORDER BY lb.id)
        FROM jsonb_array_elements_text(COALESCE(de.body->'source_limbic_ids', '[]'::jsonb)) AS old_id(val)
        LEFT JOIN "entities" lb
          ON lb.world_id = de.world_id
         AND lb.primary_component = 'content_block'
         AND lb.components @> ARRAY['limbic']::text[]
         AND lb.body->>'legacy_id' = old_id.val
        WHERE lb.id IS NOT NULL
      ), '[]'::jsonb),
      'source_conversation_ids', COALESCE(de.body->'source_conversation_ids', '[]'::jsonb),
      'episodic_snippets', COALESCE(de.body->'episodic_snippets', '[]'::jsonb),
      'legacy_id', COALESCE(de.body->>'legacy_id', de.id::text)
    ),
    de.created_at,
    de.updated_at
  FROM "entities" de
  JOIN "entities" d
    ON d.world_id = de.world_id
   AND d.primary_component = 'diary_entry'
   AND left(d.body->>'entry_at', 10) = de.body->>'dream_day'
  WHERE de.primary_component = 'dream_entry'
    AND nullif(btrim(de.content), '') IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM "entities" b
      WHERE b.world_id = de.world_id
        AND b.primary_component = 'content_block'
        AND b.components @> ARRAY['dream']::text[]
        AND (b.body->>'parent_id')::bigint = d.id
    );

  DELETE FROM "entities" WHERE primary_component = 'dream_entry';
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "limbic_memory";
--> statement-breakpoint
DROP TABLE IF EXISTS "autobiographical_memory";
--> statement-breakpoint
DROP INDEX IF EXISTS "idx_entities_dream_entry_day";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_dream_block_parent"
  ON "entities" ((body->>'parent_id'))
  WHERE "primary_component" = 'content_block'
    AND "components" @> ARRAY['dream']::text[];
