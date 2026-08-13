import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";
import {
  pomodoroPhaseSchema,
  type PomodoroPhase,
} from "@freeanima/shared/pg-shapes/entity/pomodoro-active.ts";

export { pomodoroPhaseSchema };
export type PomodoroPhasePayload = PomodoroPhase;

export const pomodoroConfigRowSchema = z.object({
  work_minutes: z.number().int(),
  short_break_minutes: z.number().int(),
  long_break_minutes: z.number().int(),
  cycles_before_long_break: z.number().int(),
  auto_start_break: z.boolean(),
  auto_start_work: z.boolean(),
  notify_on_phase_end: z.boolean(),
  sound_enabled: z.boolean(),
});

export type PomodoroConfigRowPayload = z.infer<typeof pomodoroConfigRowSchema>;

export const pomodoroSessionRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  phase: pomodoroPhaseSchema,
  started_at: z.string(),
  finished_at: z.string().nullable(),
  planned_duration_ms: z.number().int().positive(),
  actual_duration_ms: z.number().int().nonnegative().nullable(),
  task_item_id: z.number().int().positive().nullable(),
  cycle_index: z.number().int().nonnegative(),
  interrupted: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PomodoroSessionRowPayload = z.infer<typeof pomodoroSessionRowSchema>;

export const pomodoroTaskFocusSegmentInputSchema = z.object({
  session_local_id: z.string().min(1),
  phase: pomodoroPhaseSchema,
  phase_started_at: z.string().min(1),
  task_item_id: z.number().int().positive().nullable().optional(),
  started_at: z.string().min(1),
  ended_at: z.string().min(1),
  duration_ms: z.number().int().nonnegative(),
  cycle_index: z.number().int().nonnegative().optional(),
});

export const pomodoroTaskFocusRowSchema = z.object({
  id: z.number().int().positive(),
  session_local_id: z.string(),
  pomodoro_session_id: z.number().int().positive().nullable(),
  phase: pomodoroPhaseSchema,
  phase_started_at: z.string(),
  task_item_id: z.number().int().positive().nullable(),
  started_at: z.string(),
  ended_at: z.string(),
  duration_ms: z.number().int().nonnegative(),
  cycle_index: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type PomodoroTaskFocusRowPayload = z.infer<typeof pomodoroTaskFocusRowSchema>;

export const pomodoroConfigGetInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
});
export type PomodoroConfigGetInput = z.infer<typeof pomodoroConfigGetInputSchema>;
export const pomodoroConfigGetOutputSchema = z.object({
  config: pomodoroConfigRowSchema,
});
export type PomodoroConfigGetOutput = z.infer<typeof pomodoroConfigGetOutputSchema>;

export const pomodoroConfigUpdateInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  work_minutes: z.number().int().min(1).max(120).optional(),
  short_break_minutes: z.number().int().min(1).max(60).optional(),
  long_break_minutes: z.number().int().min(1).max(60).optional(),
  cycles_before_long_break: z.number().int().min(1).max(12).optional(),
  auto_start_break: z.boolean().optional(),
  auto_start_work: z.boolean().optional(),
  notify_on_phase_end: z.boolean().optional(),
  sound_enabled: z.boolean().optional(),
});
export type PomodoroConfigUpdateInput = z.infer<typeof pomodoroConfigUpdateInputSchema>;
export const pomodoroConfigUpdateOutputSchema = z.object({
  config: pomodoroConfigRowSchema,
});
export type PomodoroConfigUpdateOutput = z.infer<typeof pomodoroConfigUpdateOutputSchema>;

export const pomodoroSessionCompleteInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  phase: pomodoroPhaseSchema,
  started_at: z.string().min(1),
  finished_at: z.string().min(1),
  planned_duration_ms: z.number().int().positive(),
  actual_duration_ms: z.number().int().nonnegative(),
  task_item_id: z.number().int().positive().nullable().optional(),
  cycle_index: z.number().int().nonnegative().optional(),
  interrupted: z.boolean().optional(),
  title: z.string().optional(),
  session_local_id: z.string().min(1).optional(),
  client_op_id: z.string().min(1).optional(),
  task_focus_segments: z.array(pomodoroTaskFocusSegmentInputSchema).optional(),
});
export type PomodoroSessionCompleteInput = z.infer<typeof pomodoroSessionCompleteInputSchema>;
export const pomodoroSessionCompleteOutputSchema = z.object({
  item: pomodoroSessionRowSchema,
});
export type PomodoroSessionCompleteOutput = z.infer<typeof pomodoroSessionCompleteOutputSchema>;

export const pomodoroSessionAbortInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  phase: pomodoroPhaseSchema,
  started_at: z.string().min(1),
  finished_at: z.string().min(1),
  planned_duration_ms: z.number().int().positive(),
  actual_duration_ms: z.number().int().nonnegative(),
  task_item_id: z.number().int().positive().nullable().optional(),
  cycle_index: z.number().int().nonnegative().optional(),
  title: z.string().optional(),
  session_local_id: z.string().min(1).optional(),
  client_op_id: z.string().min(1).optional(),
  task_focus_segments: z.array(pomodoroTaskFocusSegmentInputSchema).optional(),
});
export type PomodoroSessionAbortInput = z.infer<typeof pomodoroSessionAbortInputSchema>;
export const pomodoroSessionAbortOutputSchema = z.object({
  item: pomodoroSessionRowSchema,
});
export type PomodoroSessionAbortOutput = z.infer<typeof pomodoroSessionAbortOutputSchema>;

export const pomodoroSessionListInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  started_after: z.string().optional(),
  started_before: z.string().optional(),
  phase: pomodoroPhaseSchema.optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type PomodoroSessionListInput = z.infer<typeof pomodoroSessionListInputSchema>;
export const pomodoroSessionListOutputSchema = z.object({
  items: z.array(pomodoroSessionRowSchema),
  total: z.number().int().nonnegative(),
});
export type PomodoroSessionListOutput = z.infer<typeof pomodoroSessionListOutputSchema>;

export const pomodoroStatsPeriodSchema = z.enum(["today", "week"]);
export type PomodoroStatsPeriod = z.infer<typeof pomodoroStatsPeriodSchema>;

export const pomodoroSessionStatsInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  period: pomodoroStatsPeriodSchema.default("today"),
});
export type PomodoroSessionStatsInput = z.infer<typeof pomodoroSessionStatsInputSchema>;
export const pomodoroSessionStatsOutputSchema = z.object({
  completed_work_sessions: z.number().int().nonnegative(),
  total_focus_minutes: z.number().int().nonnegative(),
  interrupted_count: z.number().int().nonnegative(),
});
export type PomodoroSessionStatsOutput = z.infer<typeof pomodoroSessionStatsOutputSchema>;

export const pomodoroFocusListInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  task_item_id: z.number().int().positive().optional(),
  session_local_id: z.string().min(1).optional(),
  pomodoro_session_id: z.number().int().positive().optional(),
  phase_started_at: z.string().optional(),
  started_after: z.string().optional(),
  started_before: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type PomodoroFocusListInput = z.infer<typeof pomodoroFocusListInputSchema>;
export const pomodoroFocusListOutputSchema = z.object({
  items: z.array(pomodoroTaskFocusRowSchema),
  total: z.number().int().nonnegative(),
});
export type PomodoroFocusListOutput = z.infer<typeof pomodoroFocusListOutputSchema>;

export const pomodoroFocusSegmentDraftSchema = z.object({
  task_item_id: z.number().int().positive().nullable(),
  started_at: z.string().min(1),
  ended_at: z.string().nullable(),
});

export const pomodoroActiveStateSchema = z.object({
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
  focus_segments: z.array(pomodoroFocusSegmentDraftSchema),
  device_id: z.string().min(1),
  updated_at_ms: z.number().int().nonnegative(),
});

export type PomodoroActiveStatePayload = z.infer<typeof pomodoroActiveStateSchema>;

export const pomodoroActiveGetInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
});
export type PomodoroActiveGetInput = z.infer<typeof pomodoroActiveGetInputSchema>;
export const pomodoroActiveGetOutputSchema = z.object({
  active: pomodoroActiveStateSchema.nullable(),
});
export type PomodoroActiveGetOutput = z.infer<typeof pomodoroActiveGetOutputSchema>;

export const pomodoroActivePutInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  active: pomodoroActiveStateSchema,
});
export type PomodoroActivePutInput = z.infer<typeof pomodoroActivePutInputSchema>;
export const pomodoroActivePutOutputSchema = z.object({
  active: pomodoroActiveStateSchema.nullable(),
});
export type PomodoroActivePutOutput = z.infer<typeof pomodoroActivePutOutputSchema>;

export const pomodoroActiveClearInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
});
export type PomodoroActiveClearInput = z.infer<typeof pomodoroActiveClearInputSchema>;
export const pomodoroActiveClearOutputSchema = z.object({
  ok: z.literal(true),
});
export type PomodoroActiveClearOutput = z.infer<typeof pomodoroActiveClearOutputSchema>;

/** Habitat → 已连接客户端：active put/clear 后广播 */
export const pomodoroActiveChangedEventSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  active: pomodoroActiveStateSchema.nullable(),
});
export type PomodoroActiveChangedEvent = z.infer<typeof pomodoroActiveChangedEventSchema>;

export const POMODORO_ACTIVE_CHANGED_EVENT = "pomodoro.active.changed" as const;
