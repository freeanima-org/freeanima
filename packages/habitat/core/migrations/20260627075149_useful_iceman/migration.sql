UPDATE entities
SET body = COALESCE(body, '{}'::jsonb)
  || CASE
       WHEN owner_id IS NOT NULL THEN jsonb_build_object('private', true, 'owner_subject_id', owner_id)
       ELSE jsonb_build_object('private', false)
     END
WHERE type = 'world';
--> statement-breakpoint
DROP INDEX "idx_entities_owner_id";--> statement-breakpoint
ALTER TABLE "entities" DROP COLUMN "owner_id";
