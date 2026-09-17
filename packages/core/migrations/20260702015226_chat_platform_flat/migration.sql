-- bundled Chat 使用 flat platform `chat`；归一化历史 sap:chat:* 会话
--> statement-breakpoint
UPDATE "conversations"
SET "platform_info" = jsonb_strip_nulls(
  (COALESCE("platform_info", '{}'::jsonb) - 'satellite_app_id' - 'satellite_instance_id')
  || '{"platform": "chat"}'::jsonb
)
WHERE "platform_info"->>'platform' LIKE 'sap:chat:%';
