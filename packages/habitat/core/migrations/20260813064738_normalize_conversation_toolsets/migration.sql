-- 数据归一（无 DDL）：
-- conversations.cached_toolsets / staged_toolsets / functions
-- 存量可能仍为 OpenAI tool schema 对象数组；规范为工具名字符串数组。

-- cached_toolsets
UPDATE "conversations" c
SET
  "cached_toolsets" = COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(n.name) ORDER BY n.ord)
      FROM (
        SELECT
          CASE
            WHEN jsonb_typeof(t.elem) = 'string' THEN nullif(btrim(t.elem #>> '{}'), '')
            WHEN jsonb_typeof(t.elem) = 'object' THEN nullif(btrim(t.elem #>> '{function,name}'), '')
            ELSE NULL
          END AS name,
          t.ord
        FROM jsonb_array_elements(c."cached_toolsets") WITH ORDINALITY AS t(elem, ord)
      ) AS n
      WHERE n.name IS NOT NULL
    ),
    '[]'::jsonb
  )
WHERE jsonb_typeof(c."cached_toolsets") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c."cached_toolsets") AS t(elem)
    WHERE jsonb_typeof(t.elem) = 'object'
  );
--> statement-breakpoint

-- staged_toolsets
UPDATE "conversations" c
SET
  "staged_toolsets" = COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(n.name) ORDER BY n.ord)
      FROM (
        SELECT
          CASE
            WHEN jsonb_typeof(t.elem) = 'string' THEN nullif(btrim(t.elem #>> '{}'), '')
            WHEN jsonb_typeof(t.elem) = 'object' THEN nullif(btrim(t.elem #>> '{function,name}'), '')
            ELSE NULL
          END AS name,
          t.ord
        FROM jsonb_array_elements(c."staged_toolsets") WITH ORDINALITY AS t(elem, ord)
      ) AS n
      WHERE n.name IS NOT NULL
    ),
    '[]'::jsonb
  )
WHERE jsonb_typeof(c."staged_toolsets") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c."staged_toolsets") AS t(elem)
    WHERE jsonb_typeof(t.elem) = 'object'
  );
--> statement-breakpoint

-- functions
UPDATE "conversations" c
SET
  "functions" = COALESCE(
    (
      SELECT jsonb_agg(to_jsonb(n.name) ORDER BY n.ord)
      FROM (
        SELECT
          CASE
            WHEN jsonb_typeof(t.elem) = 'string' THEN nullif(btrim(t.elem #>> '{}'), '')
            WHEN jsonb_typeof(t.elem) = 'object' THEN nullif(btrim(t.elem #>> '{function,name}'), '')
            ELSE NULL
          END AS name,
          t.ord
        FROM jsonb_array_elements(c."functions") WITH ORDINALITY AS t(elem, ord)
      ) AS n
      WHERE n.name IS NOT NULL
    ),
    '[]'::jsonb
  )
WHERE jsonb_typeof(c."functions") = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(c."functions") AS t(elem)
    WHERE jsonb_typeof(t.elem) = 'object'
  );
