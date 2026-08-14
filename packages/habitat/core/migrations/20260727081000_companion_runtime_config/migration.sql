-- companion_profile → runtime companion：不迁旧 models/motions（须重传）；仅保留 behavior
--> statement-breakpoint
INSERT INTO "habitat_runtime_config" ("section", "value", "updated_at")
SELECT
  'companion',
  jsonb_build_object(
    'active_object_file_id', NULL,
    'models', '[]'::jsonb,
    'motion_library', '[]'::jsonb,
    'motion_slots', jsonb_build_object(
      'idle', '[]'::jsonb,
      'rest', '[]'::jsonb,
      'walk', '[]'::jsonb,
      'climb', '[]'::jsonb,
      'in_place', '[]'::jsonb
    ),
    'behavior', COALESCE(
      e."body"->'behavior',
      jsonb_build_object(
        'patrol_enabled', true,
        'idle_patrol_delay_sec', 180,
        'patrol_pause_sec', 10,
        'patrol_speed_px', 95,
        'double_click_patrol', true,
        'startup_walk_enabled', true
      )
    )
  ),
  COALESCE(e."updated_at", now())
FROM "entities" e
WHERE e."primary_component" = 'companion_profile'
  AND e."deleted_at" IS NULL
  AND jsonb_typeof(e."body") = 'object'
ORDER BY e."updated_at" DESC NULLS LAST, e."id" DESC
LIMIT 1
ON CONFLICT ("section") DO UPDATE SET
  "value" = EXCLUDED."value",
  "updated_at" = EXCLUDED."updated_at";
--> statement-breakpoint
UPDATE "entities"
SET "deleted_at" = now(),
    "updated_at" = now()
WHERE "primary_component" = 'companion_profile'
  AND "deleted_at" IS NULL;
