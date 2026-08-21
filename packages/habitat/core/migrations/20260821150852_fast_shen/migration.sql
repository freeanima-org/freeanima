ALTER TABLE "auto_llm_messages" ALTER COLUMN "subject_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "auto_llm_runs" ALTER COLUMN "subject_id" DROP NOT NULL;