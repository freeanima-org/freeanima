ALTER TABLE "cron_jobs" ADD COLUMN "allowed_tools" text[] DEFAULT '{}'::text[] NOT NULL;
ALTER TABLE "cron_jobs" ADD COLUMN "denied_tools" text[] DEFAULT '{}'::text[] NOT NULL;
