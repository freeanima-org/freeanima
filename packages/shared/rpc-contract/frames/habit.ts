import { z } from "zod";

export const habitPolaritySchema = z.enum(["build", "break"]);
export const habitRecordModeSchema = z.enum(["boolean", "auto", "manual"]);
export const habitDaySectionSchema = z.enum(["morning", "afternoon", "evening", "other"]);
export const habitStatusSchema = z.enum(["active", "archived"]);
export const habitCheckInStyleSchema = z.enum(["check", "stamp"]);
export const habitMoodSchema = z.enum(["great", "good", "ok", "bad"]);

export const habitReminderSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  last_notified_day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const habitFrequencySchema = z.object({
  freq: z.enum(["daily", "weekly"]),
  interval: z.number().int().positive().default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  anchor_day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});

export const habitRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  polarity: habitPolaritySchema,
  record_mode: habitRecordModeSchema,
  target: z.number().nonnegative(),
  unit: z.string().nullable(),
  auto_amount: z.number().positive().nullable(),
  frequency: habitFrequencySchema,
  day_section: habitDaySectionSchema,
  reminders: z.array(habitReminderSchema),
  enable_journal: z.boolean(),
  check_in_style: habitCheckInStyleSchema,
  status: habitStatusSchema,
  sort_order: z.number().int(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  today_amount: z.number().nonnegative().optional(),
  today_met: z.boolean().optional(),
  today_check_in_id: z.number().int().positive().nullable().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type HabitRowPayload = z.infer<typeof habitRowSchema>;

export const habitCheckInRowSchema = z.object({
  id: z.number().int().positive(),
  habit_id: z.number().int().positive(),
  day: z.string(),
  amount: z.number().nonnegative(),
  mood: habitMoodSchema.nullable(),
  note: z.string().nullable(),
  checked_at: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type HabitCheckInRowPayload = z.infer<typeof habitCheckInRowSchema>;

export const habitDayCellSchema = z.object({
  day: z.string(),
  amount: z.number().nonnegative(),
  met: z.boolean(),
  check_in_id: z.number().int().positive().nullable(),
});

export const habitStatsSchema = z.object({
  habit_id: z.number().int().positive(),
  total_met_days: z.number().int().nonnegative(),
  current_streak: z.number().int().nonnegative(),
  best_streak: z.number().int().nonnegative(),
  month_met_days: z.number().int().nonnegative(),
  month_cells: z.array(habitDayCellSchema),
});
export type HabitStatsPayload = z.infer<typeof habitStatsSchema>;

export const habitPresetSchema = z.object({
  key: z.string(),
  title: z.string(),
  polarity: habitPolaritySchema,
  record_mode: habitRecordModeSchema,
  target: z.number().nonnegative(),
  unit: z.string().nullable(),
  auto_amount: z.number().positive().nullable(),
  day_section: habitDaySectionSchema,
  icon: z.string().nullable(),
});
export type HabitPresetPayload = z.infer<typeof habitPresetSchema>;

const daySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const habitListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  status: habitStatusSchema.optional(),
  /** 为 true 时附带今日打卡摘要 */
  include_today: z.boolean().optional(),
});
export const habitListOutputSchema = z.object({ items: z.array(habitRowSchema) });

export const habitGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  include_today: z.boolean().optional(),
});
export const habitGetOutputSchema = z.object({ item: habitRowSchema });

export const habitCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().optional(),
  polarity: habitPolaritySchema.optional(),
  record_mode: habitRecordModeSchema.optional(),
  target: z.number().nonnegative().optional(),
  unit: z.string().nullable().optional(),
  auto_amount: z.number().positive().nullable().optional(),
  frequency: habitFrequencySchema.optional(),
  day_section: habitDaySectionSchema.optional(),
  reminders: z.array(habitReminderSchema).optional(),
  enable_journal: z.boolean().optional(),
  check_in_style: habitCheckInStyleSchema.optional(),
  sort_order: z.number().int().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
  client_op_id: z.string().min(1).optional(),
});
export const habitCreateOutputSchema = z.object({ item: habitRowSchema });

export const habitPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  polarity: habitPolaritySchema.optional(),
  record_mode: habitRecordModeSchema.optional(),
  target: z.number().nonnegative().optional(),
  unit: z.string().nullable().optional(),
  auto_amount: z.number().positive().nullable().optional(),
  frequency: habitFrequencySchema.optional(),
  day_section: habitDaySectionSchema.optional(),
  reminders: z.array(habitReminderSchema).optional(),
  enable_journal: z.boolean().optional(),
  check_in_style: habitCheckInStyleSchema.optional(),
  sort_order: z.number().int().optional(),
  color: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});
export const habitPatchOutputSchema = z.object({ item: habitRowSchema });

export const habitDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export const habitDeleteOutputSchema = z.object({ ok: z.literal(true) });

export const habitReorderInputSchema = z.object({
  subject_id: z.number().int().positive(),
  ordered_ids: z.array(z.number().int().positive()).min(1),
});
export const habitReorderOutputSchema = z.object({ ok: z.literal(true) });

export const habitArchiveInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export const habitArchiveOutputSchema = z.object({ item: habitRowSchema });

export const habitUnarchiveInputSchema = habitArchiveInputSchema;
export const habitUnarchiveOutputSchema = habitArchiveOutputSchema;

export const habitCheckInInputSchema = z.object({
  subject_id: z.number().int().positive(),
  habit_id: z.number().int().positive(),
  day: daySchema.optional(),
  amount_delta: z.number().positive().optional(),
  amount: z.number().nonnegative().optional(),
  mood: habitMoodSchema.nullable().optional(),
  note: z.string().nullable().optional(),
});
export const habitCheckInOutputSchema = z.object({
  check_in: habitCheckInRowSchema,
  habit: habitRowSchema,
});

export const habitUndoCheckInInputSchema = z.object({
  subject_id: z.number().int().positive(),
  habit_id: z.number().int().positive(),
  day: daySchema.optional(),
  /** 回退量；省略则删除当日记录 */
  amount_delta: z.number().positive().optional(),
});
export const habitUndoCheckInOutputSchema = z.object({
  check_in: habitCheckInRowSchema.nullable(),
  habit: habitRowSchema,
});

export const habitListCheckInsInputSchema = z.object({
  subject_id: z.number().int().positive(),
  habit_id: z.number().int().positive(),
  from: daySchema,
  to: daySchema,
});
export const habitListCheckInsOutputSchema = z.object({
  items: z.array(habitCheckInRowSchema),
});

export const habitStatsInputSchema = z.object({
  subject_id: z.number().int().positive(),
  habit_id: z.number().int().positive(),
  /** 月度格子用 YYYY-MM；缺省当月 */
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
});
export const habitStatsOutputSchema = z.object({ stats: habitStatsSchema });

export const habitPresetsInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export const habitPresetsOutputSchema = z.object({ items: z.array(habitPresetSchema) });
