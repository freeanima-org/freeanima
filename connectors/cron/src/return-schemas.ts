import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/engine-tool";

const cronJobListItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  schedule: z.string(),
  paused: z.boolean(),
  run_count: z.number(),
  next_run: z.string(),
  summary: z.string(),
});

const cronJobDetailSchema = z.object({
  id: z.string(),
  name: z.string(),
  schedule: z.string(),
  paused: z.boolean(),
  run_count: z.number(),
  repeat: z.number().nullable(),
  last_run_at: z.string().nullable(),
  next_run_at: z.string().nullable(),
  skills: z.array(z.string()).optional(),
  script: z.string().nullable().optional(),
  deliver: z.string().optional(),
  last_output: z.string().nullable().optional(),
});

export const CRON_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  cron_job: defineToolReturn({
    schema: z.discriminatedUnion("action", [
      z.object({
        ok: z.literal(true),
        action: z.literal("list"),
        count: z.number(),
        jobs: z.array(cronJobListItemSchema),
        message: z.string(),
      }),
      z.object({
        ok: z.literal(true),
        action: z.literal("get"),
        job: cronJobDetailSchema,
      }),
      z.object({
        ok: z.literal(true),
        action: z.literal("create"),
        job_id: z.string(),
        name: z.string(),
        schedule: z.string(),
        next_run: z.string().nullable(),
        message: z.string(),
      }),
      z.object({
        ok: z.literal(true),
        action: z.enum(["remove", "pause", "resume", "run"]),
        job_id: z.string(),
        message: z.string(),
        name: z.string().optional(),
      }),
    ]),
    example: {
      ok: true,
      action: "list",
      count: 1,
      jobs: [
        {
          id: "job-001",
          name: "每日摘要",
          schedule: "0 9 * * *",
          paused: false,
          run_count: 3,
          next_run: "06-11 09:00",
          summary: "活跃 · 每日摘要 · 0 9 * * *",
        },
      ],
      message: "共 1 个定时任务",
    },
  }),
};
