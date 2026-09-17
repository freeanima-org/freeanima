-- 数据归一（无 DDL）：
-- 1) task_item / calendar_event：remind_at → reminders[]（并回写 remind_at = 最早一项）
-- 2) habitat_runtime_config.llm：providers.*.backend → format
-- 3) habitat_runtime_config.mcp_servers：api_key_env → headers.Authorization = Bearer env("KEY")
--    （SSE transport 保留；协议不能自动改成 Streamable HTTP）

-- 1a) 仅有 remind_at、reminders 缺失或空：写入 reminders
UPDATE "entities" e
SET
  "body" = jsonb_set(
    e."body",
    '{reminders}',
    jsonb_build_array(jsonb_build_object('at', e."body"->>'remind_at')),
    true
  ),
  "updated_at" = now()
WHERE e."primary_component" IN ('task_item', 'calendar_event')
  AND e."deleted_at" IS NULL
  AND nullif(btrim(e."body"->>'remind_at'), '') IS NOT NULL
  AND (
    e."body"->'reminders' IS NULL
    OR jsonb_typeof(e."body"->'reminders') <> 'array'
    OR jsonb_array_length(e."body"->'reminders') = 0
  );
--> statement-breakpoint

-- 1b) 已有 reminders：将 remind_at 同步为按 at 最早一项（稳定镜像）
UPDATE "entities" e
SET
  "body" = jsonb_set(
    e."body",
    '{remind_at}',
    to_jsonb(
      (
        SELECT r.elem->>'at'
        FROM jsonb_array_elements(e."body"->'reminders') WITH ORDINALITY AS r(elem, ord)
        WHERE nullif(btrim(r.elem->>'at'), '') IS NOT NULL
        ORDER BY (r.elem->>'at') ASC NULLS LAST, r.ord ASC
        LIMIT 1
      )
    ),
    true
  ),
  "updated_at" = now()
WHERE e."primary_component" IN ('task_item', 'calendar_event')
  AND e."deleted_at" IS NULL
  AND jsonb_typeof(e."body"->'reminders') = 'array'
  AND jsonb_array_length(e."body"->'reminders') > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(e."body"->'reminders') AS r(elem)
    WHERE nullif(btrim(r.elem->>'at'), '') IS NOT NULL
  );
--> statement-breakpoint

-- 2) LLM providers：backend → format，删除 backend
UPDATE "habitat_runtime_config" h
SET
  "value" = jsonb_set(
    h."value",
    '{providers}',
    COALESCE(
      (
        SELECT jsonb_object_agg(
          p.key,
          CASE
            WHEN jsonb_typeof(p.value) = 'object'
              AND p.value ? 'backend'
              AND NOT (p.value ? 'format')
            THEN (p.value - 'backend') || jsonb_build_object('format', p.value->'backend')
            WHEN jsonb_typeof(p.value) = 'object' AND p.value ? 'backend'
            THEN p.value - 'backend'
            ELSE p.value
          END
        )
        FROM jsonb_each(h."value"->'providers') AS p(key, value)
      ),
      '{}'::jsonb
    ),
    true
  ),
  "updated_at" = now()
WHERE h."section" = 'llm'
  AND jsonb_typeof(h."value"->'providers') = 'object'
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(h."value"->'providers') AS p(key, value)
    WHERE jsonb_typeof(p.value) = 'object' AND p.value ? 'backend'
  );
--> statement-breakpoint

-- 3) MCP：api_key_env → headers.Authorization（Bearer env("KEY")），再删 api_key_env
UPDATE "habitat_runtime_config" h
SET
  "value" = COALESCE(
    (
      SELECT jsonb_object_agg(
        s.key,
        CASE
          WHEN jsonb_typeof(s.value) <> 'object' THEN s.value
          WHEN nullif(btrim(s.value->>'api_key_env'), '') IS NULL THEN s.value - 'api_key_env'
          WHEN EXISTS (
            SELECT 1
            FROM jsonb_each_text(COALESCE(s.value->'headers', '{}'::jsonb)) AS hdr(hkey, hval)
            WHERE lower(hdr.hkey) = 'authorization'
          )
          THEN s.value - 'api_key_env'
          ELSE (
            (s.value - 'api_key_env')
            || jsonb_build_object(
              'headers',
              COALESCE(s.value->'headers', '{}'::jsonb)
                || jsonb_build_object(
                  'Authorization',
                  'Bearer env("' || btrim(s.value->>'api_key_env') || '")'
                )
            )
          )
        END
      )
      FROM jsonb_each(h."value") AS s(key, value)
    ),
    '{}'::jsonb
  ),
  "updated_at" = now()
WHERE h."section" = 'mcp_servers'
  AND jsonb_typeof(h."value") = 'object'
  AND EXISTS (
    SELECT 1
    FROM jsonb_each(h."value") AS s(key, value)
    WHERE jsonb_typeof(s.value) = 'object' AND s.value ? 'api_key_env'
  );
