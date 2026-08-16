ALTER TABLE "auto_llm_runs" RENAME COLUMN "max_turns" TO "max_loop_iterations";
--> statement-breakpoint

-- conversations.goal：turn_count/max_turns → continue_count/max_continues
UPDATE "conversations" c
SET
  "goal" = (
    (c."goal" - 'turn_count' - 'max_turns')
    || jsonb_strip_nulls(
      jsonb_build_object(
        'continue_count',
        COALESCE(c."goal"->'continue_count', c."goal"->'turn_count'),
        'max_continues',
        COALESCE(c."goal"->'max_continues', c."goal"->'max_turns')
      )
    )
  )
WHERE c."goal" IS NOT NULL
  AND jsonb_typeof(c."goal") = 'object'
  AND (
    c."goal" ? 'turn_count'
    OR c."goal" ? 'max_turns'
  );
--> statement-breakpoint

-- subagent entities.body：max_turns → max_loop_iterations
UPDATE "entities" e
SET
  "body" = (
    (e."body" - 'max_turns')
    || jsonb_build_object(
      'max_loop_iterations',
      COALESCE(e."body"->'max_loop_iterations', e."body"->'max_turns')
    )
  ),
  "updated_at" = now()
WHERE e."primary_component" = 'subagent'
  AND e."deleted_at" IS NULL
  AND jsonb_typeof(e."body") = 'object'
  AND e."body" ? 'max_turns';
--> statement-breakpoint

-- habitat_runtime_config.auto_llm.subagent.max_turns → max_loop_iterations
UPDATE "habitat_runtime_config" h
SET
  "value" = jsonb_set(
    h."value",
    '{subagent}',
    (
      COALESCE(h."value"->'subagent', '{}'::jsonb)
      - 'max_turns'
    ) || jsonb_strip_nulls(
      jsonb_build_object(
        'max_loop_iterations',
        COALESCE(
          h."value"#>'{subagent,max_loop_iterations}',
          h."value"#>'{subagent,max_turns}'
        )
      )
    ),
    true
  ),
  "updated_at" = now()
WHERE h."section" = 'auto_llm'
  AND jsonb_typeof(h."value") = 'object'
  AND jsonb_typeof(h."value"->'subagent') = 'object'
  AND (h."value"#>'{subagent}') ? 'max_turns';
--> statement-breakpoint

-- habitat_runtime_config.compression.max_rounds → max_message_pairs
UPDATE "habitat_runtime_config" h
SET
  "value" = (
    (h."value" - 'max_rounds')
    || jsonb_strip_nulls(
      jsonb_build_object(
        'max_message_pairs',
        COALESCE(h."value"->'max_message_pairs', h."value"->'max_rounds')
      )
    )
  ),
  "updated_at" = now()
WHERE h."section" = 'compression'
  AND jsonb_typeof(h."value") = 'object'
  AND h."value" ? 'max_rounds';
