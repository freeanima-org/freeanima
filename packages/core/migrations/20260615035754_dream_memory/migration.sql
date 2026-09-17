CREATE TABLE "dream_memory" (
	"id" text PRIMARY KEY,
	"dream_day" text NOT NULL,
	"content" text NOT NULL,
	"source_limbic_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"source_session_ids" text[] DEFAULT '{}'::text[] NOT NULL,
	"episodic_snippets" jsonb DEFAULT '[]' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_dream_memory_dream_day" ON "dream_memory" ("dream_day");--> statement-breakpoint
CREATE INDEX "idx_dream_memory_created_at" ON "dream_memory" ("created_at" DESC NULLS LAST);
