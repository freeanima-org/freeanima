CREATE TABLE "room_federation_state" (
	"room_id" text PRIMARY KEY,
	"last_synced_seq" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "rooms" ADD COLUMN "federation_mode" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
CREATE INDEX "idx_rooms_federation_mode" ON "rooms" ("federation_mode");--> statement-breakpoint
ALTER TABLE "room_federation_state" ADD CONSTRAINT "room_federation_state_room_id_rooms_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE CASCADE;