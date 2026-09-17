-- 多 Anima：temporal_summary 按 agent 私有 world 隔离；全局 (window, period_start) 唯一会让第二世界插入撞库。
DROP INDEX IF EXISTS "idx_temporal_summary_global_window_period";
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_temporal_summary_world_window_period"
ON "entities" ("world_id", (("body" ->> 'window')), (("body" ->> 'period_start')))
WHERE "primary_component" = 'temporal_summary';
