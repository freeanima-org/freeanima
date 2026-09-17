import { bigint, boolean, index, integer, pgTable, text } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { pgTimestamptz } from "./columns/pg-timestamptz.ts";
import { entities } from "./entity/entity.ts";

export const cronJobs = pgTable(
  "cron_jobs",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    schedule: text("schedule").notNull(),
    prompt: text("prompt").notNull().default(""),
    skills: text("skills").array().notNull().default([]),
    script: text("script"),
    no_agent: boolean("no_agent").notNull().default(false),
    model_provider: text("model_provider"),
    model_name: text("model_name"),
    workdir: text("workdir"),
    context_from: text("context_from").array().notNull().default([]),
    timeout_sec: integer("timeout_sec").notNull().default(300),
    builtin: boolean("builtin").notNull().default(false),
    /** 调用方工具白名单（可选）；与技能 allowed 并集 */
    allowed_tools: text("allowed_tools").array().notNull().default([]),
    /** 调用方工具黑名单（可选）；deny 胜出 */
    denied_tools: text("denied_tools").array().notNull().default([]),
    /** 定时任务所属行动主体（entities.id）；默认 boot agent */
    subject_id: bigint("subject_id", { mode: "number" })
      .notNull()
      .references(() => entities.id),
    repeat: integer("repeat"),
    run_count: integer("run_count").notNull().default(0),
    paused: boolean("paused").notNull().default(false),
    created_at: pgTimestamptz("created_at")
      .notNull()
      .default(sql`now()`),
    updated_at: pgTimestamptz("updated_at")
      .notNull()
      .default(sql`now()`),
    last_run_at: pgTimestamptz("last_run_at"),
    last_output_ref: text("last_output_ref"),
    /** 成功时是否将输出写入通知收件箱；失败始终通知 */
    notify_on_success: boolean("notify_on_success").notNull().default(false),
  },
  (t) => [
    index("idx_cron_jobs_paused").on(t.paused),
    index("idx_cron_jobs_subject_id").on(t.subject_id),
  ],
);
