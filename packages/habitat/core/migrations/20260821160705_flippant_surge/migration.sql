CREATE TABLE "room_messages" (
	"id" text PRIMARY KEY,
	"room_id" text NOT NULL,
	"seq" bigint NOT NULL,
	"speaker_public_id" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rooms" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"owner_public_id" text NOT NULL,
	"members" jsonb DEFAULT '[]' NOT NULL,
	"speaker_public_id" text,
	"speaker_heartbeat_at" timestamp with time zone,
	"speaker_lease_until" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "agent_public_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "room_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "last_projected_room_seq" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_conversations_agent_public_id" ON "conversations" ("agent_public_id");--> statement-breakpoint
CREATE INDEX "idx_conversations_room_id" ON "conversations" ("room_id");--> statement-breakpoint
CREATE UNIQUE INDEX "room_messages_room_id_seq_uidx" ON "room_messages" ("room_id","seq");--> statement-breakpoint
CREATE INDEX "idx_room_messages_room_id" ON "room_messages" ("room_id");--> statement-breakpoint
CREATE INDEX "idx_room_messages_speaker_public_id" ON "room_messages" ("speaker_public_id");--> statement-breakpoint
CREATE INDEX "idx_rooms_updated_at" ON "rooms" ("updated_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "idx_rooms_owner_public_id" ON "rooms" ("owner_public_id");--> statement-breakpoint
ALTER TABLE "room_messages" ADD CONSTRAINT "room_messages_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;--> statement-breakpoint
UPDATE conversations c
SET agent_public_id = e.body->>'public_id'
FROM entities e
WHERE c.agent_subject_id = e.id
  AND (c.agent_public_id IS NULL OR c.agent_public_id = '')
  AND e.body->>'public_id' IS NOT NULL
  AND e.body->>'public_id' <> '';
--> statement-breakpoint
CREATE UNIQUE INDEX "conversations_room_id_agent_public_id_uidx"
  ON "conversations" ("room_id", "agent_public_id")
  WHERE "room_id" IS NOT NULL AND "agent_public_id" IS NOT NULL;
