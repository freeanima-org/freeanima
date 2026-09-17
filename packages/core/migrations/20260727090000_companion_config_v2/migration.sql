-- companion 段结构 v2：object_file_id + sort；清空旧 models/motions（须重传）；保留 behavior
--> statement-breakpoint
UPDATE "habitat_runtime_config"
SET
  "value" = jsonb_build_object(
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
      "value"->'behavior',
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
  "updated_at" = now()
WHERE "section" = 'companion';
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
    'behavior', jsonb_build_object(
      'patrol_enabled', true,
      'idle_patrol_delay_sec', 180,
      'patrol_pause_sec', 10,
      'patrol_speed_px', 95,
      'double_click_patrol', true,
      'startup_walk_enabled', true
    )
  ),
  now()
WHERE NOT EXISTS (
  SELECT 1 FROM "habitat_runtime_config" WHERE "section" = 'companion'
);
