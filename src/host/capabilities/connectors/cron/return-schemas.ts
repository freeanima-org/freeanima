import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/host/core/tool";

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
  last_output: z.string().nullable().optional(),
  notify_on_success: z.boolean().optional(),
});

const cronJobIdResultSchema = z.object({
  ok: z.literal(true),
  job_id: z.string(),
  message: z.string(),
  name: z.string().optional(),
});

export const CRON_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  cronjob_list: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      count: z.number(),
      jobs: z.array(cronJobListItemSchema),
      message: z.string(),
    }),
    example: {
      ok: true,
      count: 1,
      jobs: [
        {
          id: "job-001",
          name: "Daily summary",
          schedule: "0 9 * * *",
          paused: false,
          run_count: 3,
          next_run: "06-11 09:00",
          summary: "active · Daily summary · 0 9 * * *",
        },
      ],
      message: "1 scheduled job total",
    },
  }),
  cronjob_get: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      job: cronJobDetailSchema,
    }),
    example: {
      ok: true,
      job: {
        id: "job-001",
        name: "Daily summary",
        schedule: "0 9 * * *",
        paused: false,
        run_count: 3,
        repeat: null,
        last_run_at: "06-11 09:00",
        next_run_at: "06-12 09:00",
        skills: [],
        script: null,
        last_output: null,
        notify_on_success: false,
      },
    },
  }),
  cronjob_create: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      job_id: z.string(),
      name: z.string(),
      schedule: z.string(),
      next_run: z.string().nullable(),
      message: z.string(),
    }),
    example: {
      ok: true,
      job_id: "job-001",
      name: "Daily summary",
      schedule: "0 9 * * *",
      next_run: "06-12 09:00",
      message: "Created job Daily summary",
    },
  }),
  cronjob_remove: defineToolReturn({
    schema: cronJobIdResultSchema,
    example: { ok: true, job_id: "job-001", message: "Deleted job-001" },
  }),
  cronjob_pause: defineToolReturn({
    schema: cronJobIdResultSchema,
    example: { ok: true, job_id: "job-001", message: "Paused job-001" },
  }),
  cronjob_resume: defineToolReturn({
    schema: cronJobIdResultSchema,
    example: { ok: true, job_id: "job-001", message: "Resumed job-001" },
  }),
  cronjob_run: defineToolReturn({
    schema: cronJobIdResultSchema,
    example: {
      ok: true,
      job_id: "job-001",
      name: "Daily summary",
      message: "Triggered immediate run: Daily summary",
    },
  }),
};
