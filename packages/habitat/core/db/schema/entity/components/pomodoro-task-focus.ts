import { POMODORO_TASK_FOCUS_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { POMODORO_TASK_FOCUS_COMPONENT };

import { z } from "zod";

import { pomodoroPhaseSchema } from "./pomodoro-session.ts";

import { pomodoroLinkIdsXorRefine } from "@freeanima/shared/pg-shapes/entity/pomodoro-active.ts";

export const pomodoroTaskFocusBodySchema = z
  .object({
    session_local_id: z.string().min(1),
    pomodoro_session_id: z.number().int().positive().nullable().default(null),
    phase: pomodoroPhaseSchema,
    phase_started_at: z.string().min(1),
    task_item_id: z.number().int().positive().nullable().default(null),
    calendar_event_id: z.number().int().positive().nullable().default(null),
    habit_id: z.number().int().positive().nullable().default(null),
    started_at: z.string().min(1),
    ended_at: z.string().min(1),
    duration_ms: z.number().int().nonnegative(),
    cycle_index: z.number().int().nonnegative().default(0),
  })
  .superRefine(pomodoroLinkIdsXorRefine);

export type PomodoroTaskFocusBody = z.infer<typeof pomodoroTaskFocusBodySchema>;
