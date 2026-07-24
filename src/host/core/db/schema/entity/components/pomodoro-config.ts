import { z } from "zod";

export const POMODORO_CONFIG_COMPONENT = "pomodoro_config" as const;

export const pomodoroConfigBodySchema = z.object({
  work_minutes: z.number().int().min(1).max(120).default(25),
  short_break_minutes: z.number().int().min(1).max(60).default(5),
  long_break_minutes: z.number().int().min(1).max(60).default(15),
  cycles_before_long_break: z.number().int().min(1).max(12).default(4),
  auto_start_break: z.boolean().default(true),
  auto_start_work: z.boolean().default(false),
  notify_on_phase_end: z.boolean().default(true),
  sound_enabled: z.boolean().default(true),
});

export type PomodoroConfigBody = z.infer<typeof pomodoroConfigBodySchema>;

export const DEFAULT_POMODORO_CONFIG: PomodoroConfigBody = {
  work_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  cycles_before_long_break: 4,
  auto_start_break: true,
  auto_start_work: false,
  notify_on_phase_end: true,
  sound_enabled: true,
};
