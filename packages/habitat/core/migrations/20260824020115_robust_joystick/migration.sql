CREATE TABLE "habitat_trusted_satellites" (
	"satellite_habitat_instance_id" text PRIMARY KEY,
	"satellite_public_key" text NOT NULL,
	"label" text,
	"status" text DEFAULT 'trusted' NOT NULL,
	"linked_contact_id" bigint,
	"created_at" timestamp with time zone NOT NULL,
	"trusted_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE INDEX "idx_habitat_trusted_satellites_status" ON "habitat_trusted_satellites" ("status");--> statement-breakpoint
ALTER TABLE "habitat_trusted_satellites" ADD CONSTRAINT "habitat_trusted_satellites_linked_contact_id_entities_id_fkey" FOREIGN KEY ("linked_contact_id") REFERENCES "entities"("id") ON DELETE SET NULL;