-- Rebuild: one row per runtime config section (backfill before drop).
ALTER TABLE "habitat_runtime_config" RENAME TO "habitat_runtime_config_legacy";
--> statement-breakpoint
CREATE TABLE "habitat_runtime_config" (
	"section" text PRIMARY KEY NOT NULL,
	"value" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
INSERT INTO "habitat_runtime_config" ("section", "value", "updated_at")
SELECT
	kv.key AS "section",
	kv.value AS "value",
	legacy."updated_at"
FROM "habitat_runtime_config_legacy" AS legacy
CROSS JOIN LATERAL jsonb_each(COALESCE(legacy."document", '{}'::jsonb)) AS kv(key, value)
WHERE jsonb_typeof(COALESCE(legacy."document", '{}'::jsonb)) = 'object';
--> statement-breakpoint
DROP TABLE "habitat_runtime_config_legacy";
