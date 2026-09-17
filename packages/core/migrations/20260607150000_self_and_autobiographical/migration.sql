CREATE TABLE "self_blocks" (
	"block_key" text PRIMARY KEY NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"locked" boolean DEFAULT false NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"updated_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "autobiographical_memory" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"content" text NOT NULL,
	"significance" text DEFAULT 'normal' NOT NULL,
	"period_start" text,
	"period_end" text,
	"source_facts" text[] DEFAULT '{}' NOT NULL,
	"source_sessions" text[] DEFAULT '{}' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "idx_autobiographical_memory_status" ON "autobiographical_memory" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_autobiographical_memory_significance" ON "autobiographical_memory" USING btree ("significance");--> statement-breakpoint
CREATE INDEX "idx_autobiographical_memory_updated" ON "autobiographical_memory" USING btree ("updated_at" DESC);--> statement-breakpoint
CREATE INDEX "idx_autobiographical_memory_source_facts" ON "autobiographical_memory" USING gin ("source_facts");--> statement-breakpoint
CREATE INDEX "idx_autobiographical_memory_source_sessions" ON "autobiographical_memory" USING gin ("source_sessions");
