import { z } from "zod";

/** PG persistence + API serialization schema */
export const cronJobDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  schedule: z.string(),
  prompt: z.string().default(""),
  skills: z.array(z.string()).default([]),
  script: z.string().nullable().default(null),
  no_agent: z.boolean().default(false),
  model_provider: z.string().nullable().default(null),
  model_name: z.string().nullable().default(null),
  workdir: z.string().nullable().default(null),
  context_from: z.array(z.string()).default([]),
  timeout_sec: z.number().default(300),
  builtin: z.boolean().default(false),
  repeat: z.number().nullable().default(null),
  run_count: z.number().default(0),
  paused: z.boolean().default(false),
  created_at: z.string().default(""),
  updated_at: z.string().default(""),
  last_run_at: z.number().default(0),
  last_output_ref: z.string().nullable().default(null),
  /** 成功时是否将输出写入通知；失败始终通知 */
  notify_on_success: z.boolean().default(false),
  /** API view: computed at runtime, not stored in PG */
  next_run_at: z.number().default(0),
  /** API view: lazy-loaded from last_output_ref */
  last_output: z.string().default(""),
});

export const cronJobsFileSchema = z.array(cronJobDataSchema);

export type CronJobData = z.infer<typeof cronJobDataSchema>;
