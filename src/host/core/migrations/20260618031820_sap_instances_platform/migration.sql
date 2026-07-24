CREATE TABLE "sap_instances" (
	"instance_id" text PRIMARY KEY NOT NULL,
	"app_id" text NOT NULL,
	"http_url" text,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
UPDATE "sessions"
SET "platform_info" = jsonb_strip_nulls(
  COALESCE("platform_info", '{}'::jsonb)
  || jsonb_build_object(
    'platform', 'sap:parlor:' || COALESCE(NULLIF("platform_info"->>'satellite_instance_id', ''), 'web'),
    'satellite_app_id', 'parlor',
    'satellite_instance_id', COALESCE(NULLIF("platform_info"->>'satellite_instance_id', ''), 'web')
  )
)
WHERE "platform_info"->>'platform' = 'parlor';
--> statement-breakpoint
UPDATE "sessions"
SET "platform_info" = jsonb_strip_nulls(
  COALESCE("platform_info", '{}'::jsonb)
  || jsonb_build_object(
    'platform', 'sap:pairprogramming:' || COALESCE(NULLIF("platform_info"->>'satellite_instance_id', ''), 'web'),
    'satellite_app_id', 'pairprogramming',
    'satellite_instance_id', COALESCE(NULLIF("platform_info"->>'satellite_instance_id', ''), 'web')
  )
)
WHERE "platform_info"->>'platform' = 'studio-pair-programming';
--> statement-breakpoint
UPDATE "sessions"
SET "platform_info" = jsonb_strip_nulls(
  COALESCE("platform_info", '{}'::jsonb)
  || jsonb_build_object(
    'platform', 'sap:companion:' || COALESCE(NULLIF("platform_info"->>'satellite_instance_id', ''), 'web'),
    'satellite_app_id', 'companion',
    'satellite_instance_id', COALESCE(NULLIF("platform_info"->>'satellite_instance_id', ''), 'web')
  )
)
WHERE "platform_info"->>'platform' = 'companion';
--> statement-breakpoint
UPDATE "sessions"
SET "platform_info" = jsonb_strip_nulls(
  COALESCE("platform_info", '{}'::jsonb)
  || jsonb_build_object(
    'satellite_app_id', split_part("platform_info"->>'platform', ':', 2),
    'satellite_instance_id', split_part("platform_info"->>'platform', ':', 3)
  )
)
WHERE "platform_info"->>'platform' LIKE 'sap:%'
  AND (
    "platform_info"->>'satellite_app_id' IS NULL
    OR "platform_info"->>'satellite_instance_id' IS NULL
  );
