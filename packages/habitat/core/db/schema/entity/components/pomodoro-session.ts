import { z } from "zod";

import {
  POMODORO_SESSION_COMPONENT,
  pomodoroPhaseSchema,
  type PomodoroPhase,
} from "@freeanima/shared/entity-shapes";

export { POMODORO_SESSION_COMPONENT, pomodoroPhaseSchema, type PomodoroPhase };

import { pomodoroLinkIdsXorRefine } from "@freeanima/shared/pg-shapes/entity/pomodoro-active.ts";

export const pomodoroSessionBodySchema = z
  .object({
    phase: pomodoroPhaseSchema,
    started_at: z.string().min(1),
    finished_at: z.string().nullable(),
    planned_duration_ms: z.number().int().positive(),
    actual_duration_ms: z.number().int().nonnegative().nullable(),
    task_item_id: z.number().int().positive().nullable().default(null),
    calendar_event_id: z.number().int().positive().nullable().default(null),
    habit_id: z.number().int().positive().nullable().default(null),
    cycle_index: z.number().int().nonnegative().default(0),
    interrupted: z.boolean().default(false),
  })
  .superRefine(pomodoroLinkIdsXorRefine);

export type PomodoroSessionBody = z.infer<typeof pomodoroSessionBodySchema>;
