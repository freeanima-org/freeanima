CREATE TABLE "semantic_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text DEFAULT 'world' NOT NULL,
	"pinned" boolean DEFAULT false NOT NULL,
	"content" text NOT NULL,
	"content_fts" "tsvector" GENERATED ALWAYS AS (to_tsvector('simple', message_fts_input("content"))) STORED,
	"created" timestamp with time zone DEFAULT now() NOT NULL,
	"updated" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_fts" ON "semantic_memory" USING gin ("content_fts");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_type" ON "semantic_memory" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_semantic_memory_pinned" ON "semantic_memory" USING btree ("pinned");
