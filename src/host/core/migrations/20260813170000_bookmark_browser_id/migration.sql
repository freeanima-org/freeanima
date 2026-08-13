CREATE UNIQUE INDEX IF NOT EXISTS "idx_entities_bookmark_browser_id"
ON "entities" (
  "world_id",
  (body->>'browser_id')
)
WHERE primary_component = 'bookmark'
  AND nullif(btrim(body->>'browser_id'), '') IS NOT NULL;
