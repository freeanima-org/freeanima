-- 任务/事件时间模型收紧（无 DDL）：
-- 1) task_item：旧「仅 due」→ 计划单点 start_at；旧「start+due」→ end_at=旧 due 并清 due
-- 2) task_item reminders：补默认 anchor
-- 3) calendar_event：去掉 body.due_at；remind_at → reminders[]；anchor=start

-- 1a) 仅 due_at、无 start_at：due → start，清空 due；提醒锚点 start
UPDATE "entities" e
SET
  "body" = (
    jsonb_set(
      jsonb_set(
        jsonb_set(e."body", '{start_at}', to_jsonb(e."body"->>'due_at'), true),
        '{end_at}',
        'null'::jsonb,
        true
      ),
      '{due_at}',
      'null'::jsonb,
      true
    )
    || jsonb_build_object(
      'reminders',
      CASE
        WHEN jsonb_typeof(e."body"->'reminders') = 'array'
          AND jsonb_array_length(e."body"->'reminders') > 0
        THEN (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN jsonb_typeof(r.elem) = 'object' AND NOT (r.elem ? 'anchor')
              THEN r.elem || jsonb_build_object('anchor', 'start')
              ELSE r.elem
            END
            ORDER BY r.ord
          ), '[]'::jsonb)
          FROM jsonb_array_elements(e."body"->'reminders') WITH ORDINALITY AS r(elem, ord)
        )
        ELSE COALESCE(e."body"->'reminders', '[]'::jsonb)
      END
    )
  ),
  "updated_at" = now()
WHERE e."primary_component" = 'task_item'
  AND e."deleted_at" IS NULL
  AND nullif(btrim(e."body"->>'due_at'), '') IS NOT NULL
  AND nullif(btrim(e."body"->>'start_at'), '') IS NULL
  AND (
    e."body"->'end_at' IS NULL
    OR e."body"->>'end_at' IS NULL
    OR nullif(btrim(e."body"->>'end_at'), '') IS NULL
  );
--> statement-breakpoint

-- 1b) start_at + due_at、无 end_at：due → end，清空 due；提醒锚点 end
UPDATE "entities" e
SET
  "body" = (
    jsonb_set(
      jsonb_set(e."body", '{end_at}', to_jsonb(e."body"->>'due_at'), true),
      '{due_at}',
      'null'::jsonb,
      true
    )
    || jsonb_build_object(
      'reminders',
      CASE
        WHEN jsonb_typeof(e."body"->'reminders') = 'array'
          AND jsonb_array_length(e."body"->'reminders') > 0
        THEN (
          SELECT COALESCE(jsonb_agg(
            CASE
              WHEN jsonb_typeof(r.elem) = 'object' AND NOT (r.elem ? 'anchor')
              THEN r.elem || jsonb_build_object('anchor', 'end')
              ELSE r.elem
            END
            ORDER BY r.ord
          ), '[]'::jsonb)
          FROM jsonb_array_elements(e."body"->'reminders') WITH ORDINALITY AS r(elem, ord)
        )
        ELSE COALESCE(e."body"->'reminders', '[]'::jsonb)
      END
    )
  ),
  "updated_at" = now()
WHERE e."primary_component" = 'task_item'
  AND e."deleted_at" IS NULL
  AND nullif(btrim(e."body"->>'due_at'), '') IS NOT NULL
  AND nullif(btrim(e."body"->>'start_at'), '') IS NOT NULL
  AND (
    e."body"->'end_at' IS NULL
    OR e."body"->>'end_at' IS NULL
    OR nullif(btrim(e."body"->>'end_at'), '') IS NULL
  );
--> statement-breakpoint

-- 2) 事件：剥 due_at
UPDATE "entities" e
SET
  "body" = e."body" - 'due_at',
  "updated_at" = now()
WHERE e."primary_component" = 'calendar_event'
  AND e."deleted_at" IS NULL
  AND e."body" ? 'due_at';
--> statement-breakpoint

-- 3a) 事件：仅 remind_at → reminders[{at, anchor:start}]
UPDATE "entities" e
SET
  "body" = jsonb_set(
    e."body",
    '{reminders}',
    jsonb_build_array(
      jsonb_build_object(
        'at', e."body"->>'remind_at',
        'anchor', 'start'
      )
    ),
    true
  ),
  "updated_at" = now()
WHERE e."primary_component" = 'calendar_event'
  AND e."deleted_at" IS NULL
  AND nullif(btrim(e."body"->>'remind_at'), '') IS NOT NULL
  AND (
    e."body"->'reminders' IS NULL
    OR jsonb_typeof(e."body"->'reminders') <> 'array'
    OR jsonb_array_length(e."body"->'reminders') = 0
  );
--> statement-breakpoint

-- 3b) 事件 reminders 补 anchor=start
UPDATE "entities" e
SET
  "body" = jsonb_set(
    e."body",
    '{reminders}',
    (
      SELECT COALESCE(jsonb_agg(
        CASE
          WHEN jsonb_typeof(r.elem) = 'object' AND NOT (r.elem ? 'anchor')
          THEN r.elem || jsonb_build_object('anchor', 'start')
          ELSE r.elem
        END
        ORDER BY r.ord
      ), '[]'::jsonb)
      FROM jsonb_array_elements(e."body"->'reminders') WITH ORDINALITY AS r(elem, ord)
    ),
    true
  ),
  "updated_at" = now()
WHERE e."primary_component" = 'calendar_event'
  AND e."deleted_at" IS NULL
  AND jsonb_typeof(e."body"->'reminders') = 'array'
  AND jsonb_array_length(e."body"->'reminders') > 0
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(e."body"->'reminders') AS r(elem)
    WHERE jsonb_typeof(r.elem) = 'object' AND NOT (r.elem ? 'anchor')
  );
