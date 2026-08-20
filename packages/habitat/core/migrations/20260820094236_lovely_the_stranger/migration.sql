ALTER TABLE "service_api_tokens" ADD COLUMN "authorization" jsonb DEFAULT '{"full":true}' NOT NULL;--> statement-breakpoint
ALTER TABLE "service_api_tokens" DROP COLUMN "scopes";