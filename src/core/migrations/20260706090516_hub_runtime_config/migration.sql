CREATE TABLE "hub_runtime_config" (
	"id" text PRIMARY KEY NOT NULL,
	"document" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
