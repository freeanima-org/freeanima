ALTER TABLE "entities" ADD COLUMN IF NOT EXISTS "revisions" jsonb DEFAULT '[]'::jsonb NOT NULL;
