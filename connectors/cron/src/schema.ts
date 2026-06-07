import { z } from "zod";

/** PG 持久化 + API 序列化 schema */
export const cronJobDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  schedule: z.string(),
  prompt: z.string().default(""),
  skills: z.array(z.string()).default([]),
  script: z.string().nullable().default(null),
  no_agent: z.boolean().default(false),
  enabled_toolsets: z.array(z.string()).nullable().default(null),
  model_provider: z.string().nullable().default(null),
  model_name: z.string().nullable().default(null),
  workdir: z.string().nullable().default(null),
  context_from: z.array(z.string()).default([]),
  deliver: z.string().default("local"),
  timeout_sec: z.number().default(300),
  builtin: z.boolean().default(false),
  repeat: z.number().nullable().default(null),
  run_count: z.number().default(0),
  paused: z.boolean().default(false),
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
  last_run_at: z.number().default(0),
  last_output_ref: z.string().nullable().default(null),
  /** API 视图：运行时计算，不入 PG */
  next_run_at: z.number().default(0),
  /** API 视图：从 last_output_ref 懒加载 */
  last_output: z.string().default(""),
});

export const cronJobsFileSchema = z.array(cronJobDataSchema);

export type CronJobData = z.infer<typeof cronJobDataSchema>;
