-- Backfill dream_memory → entities (dream_entry) in first agent's default private world.
DO $$
DECLARE
  dream_count integer;
  agent_world_id bigint;
BEGIN
  SELECT count(*)::integer INTO dream_count FROM "dream_memory";
  IF dream_count = 0 THEN
    RETURN;
  END IF;

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
    RAISE EXCEPTION 'dream_memory backfill failed: no agent with default private world';
  END IF;

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
    agent_world_id,
    ARRAY['dream_entry']::text[],
    'dream_entry',
    d.dream_day,
    '',
    d.content,
    jsonb_build_object(
      'dream_day', d.dream_day,
      'legacy_id', d.id,
      'source_limbic_ids', to_jsonb(d.source_limbic_ids),
      'source_conversation_ids', to_jsonb(d.source_conversation_ids),
      'episodic_snippets', d.episodic_snippets
    ),
    d.created_at,
    d.created_at
  FROM "dream_memory" d
  WHERE NOT EXISTS (
    SELECT 1 FROM "entities" e
    WHERE e.world_id = agent_world_id
      AND e.primary_component = 'dream_entry'
      AND e.body->>'dream_day' = d.dream_day
  );
END $$;
--> statement-breakpoint
DROP TABLE IF EXISTS "dream_memory";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_dream_entry_day"
  ON "entities" ("world_id", (body->>'dream_day'))
  WHERE "primary_component" = 'dream_entry';
