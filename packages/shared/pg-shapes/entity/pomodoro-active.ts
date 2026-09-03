import { z } from "zod";

export const pomodoroPhaseSchema = z.enum(["work", "short_break", "long_break"]);
export type PomodoroPhase = z.infer<typeof pomodoroPhaseSchema>;

/** 番茄关联目标：任务 / 日历事件 / 习惯 至多其一 */
export function pomodoroLinkIdsXorRefine(
  value: {
    task_item_id: number | null;
    calendar_event_id: number | null;
    habit_id?: number | null;
  },
  ctx: z.RefinementCtx,
): void {
  const links = [
    value.task_item_id != null,
    value.calendar_event_id != null,
    value.habit_id != null,
  ].filter(Boolean).length;
  if (links > 1) {
    ctx.addIssue({
      code: "custom",
      message: "task_item_id / calendar_event_id / habit_id are mutually exclusive",
      path: ["calendar_event_id"],
    });
  }
}

export const pomodoroFocusSegmentDraftSchema = z
  .object({
    task_item_id: z.number().int().positive().nullable(),
    calendar_event_id: z.number().int().positive().nullable().default(null),
    habit_id: z.number().int().positive().nullable().default(null),
    started_at: z.string().min(1),
    ended_at: z.string().nullable(),
  })
  .superRefine(pomodoroLinkIdsXorRefine);

export const pomodoroActiveBodySchema = z
  .object({
    phase: pomodoroPhaseSchema,
    run_state: z.enum(["running", "paused"]),
    phase_planned_ms: z.number().int().positive(),
    phase_ends_at: z.number().int().nullable(),
    paused_remaining_ms: z.number().int().nonnegative().nullable(),
    cycle_index: z.number().int().nonnegative(),
    completed_work_in_cycle: z.number().int().nonnegative(),
    task_item_id: z.number().int().positive().nullable(),
    calendar_event_id: z.number().int().positive().nullable().default(null),
    habit_id: z.number().int().positive().nullable().default(null),
    session_local_id: z.string().min(1),
    phase_started_at: z.string().min(1),
    focus_segments: z.array(pomodoroFocusSegmentDraftSchema).default([]),
    device_id: z.string().min(1),
    updated_at_ms: z.number().int().nonnegative(),
  })
  .superRefine(pomodoroLinkIdsXorRefine);

export type PomodoroActiveBody = z.infer<typeof pomodoroActiveBodySchema>;
