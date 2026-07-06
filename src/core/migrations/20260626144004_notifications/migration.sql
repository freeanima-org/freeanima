CREATE TABLE "notifications" (
	"id" text PRIMARY KEY,
	"recipient_kind" text NOT NULL,
	"recipient_id" text DEFAULT 'default' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"payload" jsonb,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source_kind" text,
	"source_ref" text
);
--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient_created" ON "notifications" ("recipient_kind","recipient_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_recipient_read" ON "notifications" ("recipient_kind","recipient_id","read_at");