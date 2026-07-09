import { z } from "zod";

export const POMODORO_SESSION_COMPONENT = "pomodoro_session" as const;

export const pomodoroPhaseSchema = z.enum(["work", "short_break", "long_break"]);
export type PomodoroPhase = z.infer<typeof pomodoroPhaseSchema>;

export const pomodoroSessionBodySchema = z.object({
  phase: pomodoroPhaseSchema,
  started_at: z.string().min(1),
  finished_at: z.string().nullable(),
  planned_duration_ms: z.number().int().positive(),
  actual_duration_ms: z.number().int().nonnegative().nullable(),
  task_item_id: z.number().int().positive().nullable().default(null),
  cycle_index: z.number().int().nonnegative().default(0),
  interrupted: z.boolean().default(false),
});

export type PomodoroSessionBody = z.infer<typeof pomodoroSessionBodySchema>;
