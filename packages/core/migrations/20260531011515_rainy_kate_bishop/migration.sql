CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"model" text NOT NULL,
	"title" text,
	"cwd" text,
	"system_prompt" text,
	"platform_info" jsonb,
	"compression" jsonb,
	"todos" jsonb DEFAULT '{"items":[],"next_id":1}' NOT NULL,
	"awaiting_clarify" jsonb,
	"acp_sessions" jsonb,
	"tools" jsonb DEFAULT '[]' NOT NULL,
	"functions" jsonb DEFAULT '[]' NOT NULL,
	"debug" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" text PRIMARY KEY,
	"session_id" text NOT NULL,
	"pos" bigint NOT NULL,
	"content" text DEFAULT '' NOT NULL,
	"ts" timestamp with time zone NOT NULL,
	"role_payload" jsonb NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "messages_session_id_pos_uidx" ON "messages" ("session_id","pos");--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE;