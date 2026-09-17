-- 会话 platform / scenario 归一；去掉 module 列
-- 顺序：加 scenario → 数据回填/清理 → DROP module

ALTER TABLE "conversations" ADD COLUMN "scenario" text;
--> statement-breakpoint

-- A) 删除历史 cron 会话（messages CASCADE；对齐 purgeCronConversations 的会话删除）
DELETE FROM "conversations"
WHERE COALESCE("platform_info"->>'platform', '') = 'cron';
--> statement-breakpoint

-- B) remote:coding:* / remote:companion:* → flat platform + outpost_* 字段
UPDATE "conversations"
SET "platform_info" = jsonb_strip_nulls(
  (
    COALESCE("platform_info", '{}'::jsonb)
    - 'satellite_app_id' - 'satellite_instance_id'
  )
  || jsonb_build_object(
    'platform', split_part("platform_info"->>'platform', ':', 2),
    'outpost_app_id', COALESCE(
      NULLIF(btrim("platform_info"->>'outpost_app_id'), ''),
      NULLIF(btrim("platform_info"->>'satellite_app_id'), ''),
      split_part("platform_info"->>'platform', ':', 2)
    ),
    'outpost_instance_id', COALESCE(
      NULLIF(btrim("platform_info"->>'outpost_instance_id'), ''),
      NULLIF(btrim("platform_info"->>'satellite_instance_id'), ''),
      split_part("platform_info"->>'platform', ':', 3)
    )
  )
)
WHERE ("platform_info"->>'platform') ~ '^(remote|sap):(coding|companion):[^:]+$';
--> statement-breakpoint

-- C) 空 / sap:* / 非法 / 残留 remote: → flat chat（保留合法 chat|weixin|discord|coding|companion）
UPDATE "conversations"
SET "platform_info" = jsonb_strip_nulls(
  (
    COALESCE("platform_info", '{}'::jsonb)
    - 'satellite_app_id' - 'satellite_instance_id'
    - 'outpost_app_id' - 'outpost_instance_id'
  )
  || '{"platform": "chat"}'::jsonb
)
WHERE "platform_info" IS NULL
   OR nullif(btrim("platform_info"->>'platform'), '') IS NULL
   OR NOT (
        "platform_info"->>'platform' IN ('chat', 'weixin', 'discord', 'coding', 'companion')
   );
--> statement-breakpoint

-- D) scenario 回填（须在 DROP module 前）：旧 module=coding 或 platform=coding → coding_agent
UPDATE "conversations"
SET "scenario" = CASE
  WHEN "module" = 'coding' THEN 'coding_agent'
  WHEN "platform_info"->>'platform' = 'coding' THEN 'coding_agent'
  ELSE 'digital_human'
END
WHERE "scenario" IS NULL
   OR nullif(btrim("scenario"), '') IS NULL
   OR "scenario" NOT IN ('digital_human', 'coding_agent');
--> statement-breakpoint

ALTER TABLE "conversations" DROP COLUMN "module";
