CREATE TABLE "service_api_tokens" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "service_api_tokens_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"subject_id" bigint NOT NULL,
	"name" text NOT NULL,
	"prefix" text NOT NULL,
	"token_hash" text NOT NULL,
	"scopes" text[] DEFAULT '{"full"}'::text[] NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone,
	"last_used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "service_api_tokens" ADD CONSTRAINT "service_api_tokens_subject_id_entities_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."entities"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_service_api_tokens_prefix" ON "service_api_tokens" USING btree ("prefix");--> statement-breakpoint
CREATE INDEX "idx_service_api_tokens_subject_id" ON "service_api_tokens" USING btree ("subject_id");
