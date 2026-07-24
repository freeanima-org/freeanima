import { defineToolReturn, type ToolReturnContractFields, z } from "@freeanima/host/core/tool";

const pomodoroConfigSchema = z.object({
  work_minutes: z.number(),
  short_break_minutes: z.number(),
  long_break_minutes: z.number(),
  cycles_before_long_break: z.number(),
  auto_start_break: z.boolean(),
  auto_start_work: z.boolean(),
  notify_on_phase_end: z.boolean(),
  sound_enabled: z.boolean(),
});

const pomodoroSessionSchema = z.object({
  id: z.number(),
  title: z.string(),
  phase: z.enum(["work", "short_break", "long_break"]),
  started_at: z.string(),
  finished_at: z.string().nullable(),
  planned_duration_ms: z.number(),
  actual_duration_ms: z.number().nullable(),
  task_item_id: z.number().nullable(),
  cycle_index: z.number(),
  interrupted: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

const exampleConfig = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_break: true,
  auto_start_work: false,
  notify_on_phase_end: true,
  sound_enabled: true,
};

const exampleSession = {
  id: 1,
  title: "番茄钟 #1",
  phase: "work" as const,
  started_at: "2026-07-09T10:00:00+08:00",
  finished_at: "2026-07-09T10:25:00+08:00",
  planned_duration_ms: 1_500_000,
  actual_duration_ms: 1_500_000,
  task_item_id: null,
  cycle_index: 0,
  interrupted: false,
  created_at: "2026-07-09T10:25:00+08:00",
  updated_at: "2026-07-09T10:25:00+08:00",
};

export const POMODORO_TOOL_RETURNS: Record<string, ToolReturnContractFields> = {
  pomodoro_config_get: defineToolReturn({
    schema: z.object({ ok: z.literal(true), config: pomodoroConfigSchema }),
    example: { ok: true, config: exampleConfig },
  }),
  pomodoro_config_update: defineToolReturn({
    schema: z.object({ ok: z.literal(true), config: pomodoroConfigSchema }),
    example: { ok: true, config: exampleConfig },
  }),
  pomodoro_session_complete: defineToolReturn({
    schema: z.object({ ok: z.literal(true), item: pomodoroSessionSchema }),
    example: { ok: true, item: exampleSession },
  }),
  pomodoro_session_list: defineToolReturn({
    schema: z.object({ ok: z.literal(true), items: z.array(pomodoroSessionSchema) }),
    example: { ok: true, items: [exampleSession] },
  }),
  pomodoro_stats: defineToolReturn({
    schema: z.object({
      ok: z.literal(true),
      completed_work_sessions: z.number(),
      total_focus_minutes: z.number(),
      interrupted_count: z.number(),
    }),
    example: {
      ok: true,
      completed_work_sessions: 2,
      total_focus_minutes: 50,
      interrupted_count: 0,
    },
  }),
};
