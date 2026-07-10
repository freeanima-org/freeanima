import { z } from "zod";

import { pomodoroPhaseSchema } from "./pomodoro-session.ts";

export const POMODORO_ACTIVE_COMPONENT = "pomodoro_active" as const;

export const pomodoroFocusSegmentDraftSchema = z.object({
  task_item_id: z.number().int().positive().nullable(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable(),
});

export const pomodoroActiveBodySchema = z.object({
  phase: pomodoroPhaseSchema,
  run_state: z.enum(["running", "paused"]),
  phase_planned_ms: z.number().int().positive(),
  phase_ends_at: z.number().int().nullable(),
  paused_remaining_ms: z.number().int().nonnegative().nullable(),
  cycle_index: z.number().int().nonnegative(),
  completed_work_in_cycle: z.number().int().nonnegative(),
  task_item_id: z.number().int().positive().nullable(),
  session_local_id: z.string().min(1),
  phase_started_at: z.string().min(1),
  focus_segments: z.array(pomodoroFocusSegmentDraftSchema).default([]),
  device_id: z.string().min(1),
  updated_at_ms: z.number().int().nonnegative(),
});

export type PomodoroActiveBody = z.infer<typeof pomodoroActiveBodySchema>;
