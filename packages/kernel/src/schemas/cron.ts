import { z } from "zod";

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
  next_run_at: z.number().default(0),
  last_run_at: z.number().default(0),
  last_output: z.string().default(""),
});

export const cronJobsFileSchema = z.array(cronJobDataSchema);

export type CronJobData = z.infer<typeof cronJobDataSchema>;
