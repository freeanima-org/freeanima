-- Drop project milestones + completion_criteria; keep background in entity.content
-- 1) unlink tasks from milestones
-- 2) delete milestone entities
-- 3) backfill project.content from completion_criteria when empty; strip body key

UPDATE "entities"
SET
  body = (body || '{"milestone_id": null}'::jsonb) - 'milestone_id',
  updated_at = NOW()
WHERE primary_component = 'task_item'
  AND body ? 'milestone_id';
--> statement-breakpoint

DELETE FROM "entities"
WHERE primary_component = 'milestone';
--> statement-breakpoint

UPDATE "entities"
SET
  content = COALESCE(
    NULLIF(TRIM(content), ''),
    NULLIF(TRIM(body->>'completion_criteria'), ''),
    content
  ),
  body = body - 'completion_criteria',
  updated_at = NOW()
WHERE primary_component = 'project'
  AND body ? 'completion_criteria';
