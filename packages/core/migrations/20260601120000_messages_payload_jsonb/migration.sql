ALTER TABLE "messages" ADD COLUMN "payload" jsonb;--> statement-breakpoint
UPDATE "messages" SET "payload" = "role_payload" || jsonb_build_object(
  'content', "content",
  'timestamp', to_char("ts" AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')
);--> statement-breakpoint
ALTER TABLE "messages" ALTER COLUMN "payload" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "content";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "ts";--> statement-breakpoint
ALTER TABLE "messages" DROP COLUMN "role_payload";
