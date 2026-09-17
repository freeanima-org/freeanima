ALTER TABLE "habitat_trusted_satellites" ALTER COLUMN "status" SET DEFAULT 'pending';--> statement-breakpoint
ALTER TABLE "habitat_trusted_satellites" ALTER COLUMN "trusted_at" DROP NOT NULL;