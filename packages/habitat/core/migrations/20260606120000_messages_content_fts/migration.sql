CREATE OR REPLACE FUNCTION message_fts_input(t text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT trim(both from regexp_replace(
    regexp_replace(coalesce(t, ''), '([^[:ascii:]])', E'\\1 ', 'g'),
    '\s+', ' ', 'g'
  ));
$$;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "content_fts" tsvector GENERATED ALWAYS AS (
  CASE
    WHEN (payload->>'role') IN ('user', 'assistant')
      AND length(btrim(payload->>'content')) > 0
    THEN to_tsvector('simple', message_fts_input(payload->>'content'))
    ELSE NULL
  END
) STORED;--> statement-breakpoint
CREATE INDEX "messages_content_fts_gin" ON "messages" USING GIN ("content_fts");
