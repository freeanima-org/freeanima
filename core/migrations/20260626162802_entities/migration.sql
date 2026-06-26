CREATE TABLE "entities" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "entities_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"type" text NOT NULL,
	"world_id" bigint NOT NULL,
	"owner_id" bigint,
	"components" text[] DEFAULT '{}'::text[] NOT NULL,
	"primary_component" text NOT NULL,
	"body" jsonb DEFAULT '{}' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_entities_world_id" ON "entities" ("world_id");--> statement-breakpoint
CREATE INDEX "idx_entities_owner_id" ON "entities" ("owner_id");--> statement-breakpoint
CREATE INDEX "idx_entities_primary_component" ON "entities" ("primary_component");--> statement-breakpoint
CREATE INDEX "idx_entities_components" ON "entities" USING gin ("components");--> statement-breakpoint
INSERT INTO "entities" ("id", "type", "world_id", "owner_id", "components", "primary_component", "body")
OVERRIDING SYSTEM VALUE
VALUES (1, 'world', 1, NULL, ARRAY['world_config']::text[], 'world_config', '{"name":"我的任务"}'::jsonb);
--> statement-breakpoint
SELECT setval(pg_get_serial_sequence('entities', 'id'), GREATEST((SELECT MAX(id) FROM entities), 1));