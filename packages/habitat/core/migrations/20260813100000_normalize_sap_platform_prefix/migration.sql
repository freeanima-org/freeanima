-- 数据归一（无 DDL）：已存会话 platform_info.platform 的遗留 sap: 前缀 → remote:
-- 仅三段式 sap:app:instance；畸形行留给读路径 soft-skip
--> statement-breakpoint
UPDATE "conversations"
SET "platform_info" = jsonb_set(
  "platform_info",
  '{platform}',
  to_jsonb('remote:' || substr("platform_info"->>'platform', 5))
)
WHERE "platform_info"->>'platform' LIKE 'sap:%'
  AND ("platform_info"->>'platform') ~ '^sap:[^:]+:[^:]+$';
--> statement-breakpoint
-- parlor 已更名为 chat：残留 remote:parlor:* / sap:parlor:* 压成 flat chat（不碰 remote:chat:*）
UPDATE "conversations"
SET "platform_info" = jsonb_strip_nulls(
  (COALESCE("platform_info", '{}'::jsonb) - 'satellite_app_id' - 'satellite_instance_id'
    - 'outpost_app_id' - 'outpost_instance_id')
  || '{"platform": "chat"}'::jsonb
)
WHERE "platform_info"->>'platform' LIKE 'remote:parlor:%'
   OR "platform_info"->>'platform' LIKE 'sap:parlor:%';
