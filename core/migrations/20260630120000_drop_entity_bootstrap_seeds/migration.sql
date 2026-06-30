-- 移除旧 migration bootstrap 种子（公开 world id=1、Inbox task_list id=2）；默认实体改由启动代码 ensure。
--> statement-breakpoint
DELETE FROM entities e
WHERE e.id = 2
  AND e.type = 'content'
  AND e.primary_component = 'task_list'
  AND COALESCE(e.body->>'is_default', 'false') = 'true'
  AND NOT EXISTS (
    SELECT 1 FROM entities s WHERE s.id = 2 AND s.type IN ('user', 'agent')
  );
--> statement-breakpoint
DELETE FROM entities e
WHERE e.id = 1
  AND e.type = 'world'
  AND e.primary_component = 'world_config'
  AND NOT EXISTS (
    SELECT 1 FROM entities s WHERE s.id = 1 AND s.type IN ('user', 'agent')
  )
  AND NOT EXISTS (
    SELECT 1 FROM entities c
    WHERE c.world_id = 1
      AND c.id <> 1
      AND c.primary_component IN ('task_item', 'task_list', 'email_account', 'email_thread', 'email_message')
  );
--> statement-breakpoint
SELECT setval(
  pg_get_serial_sequence('entities', 'id'),
  GREATEST(COALESCE((SELECT MAX(id) FROM entities), 0), 1)
);
