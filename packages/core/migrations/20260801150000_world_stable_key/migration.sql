CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_world_stable_key"
ON "entities" ((body->>'stable_key'))
WHERE primary_component = 'world_config'
  AND nullif(btrim(body->>'stable_key'), '') IS NOT NULL;
