import { z } from "zod";

const calendarReminderAnchorSchema = z.enum(["start", "end", "due"]);

const calendarReminderEntrySchema = z.object({
  at: z.string().min(1),
  /** 事件提醒锚定开始；缺省按 start */
  anchor: calendarReminderAnchorSchema.optional(),
  last_notified_at: z.string().nullable().optional(),
});

export const calendarEventRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  all_day: z.boolean(),
  remind_at: z.string().nullable(),
  /** 多提醒真源；与 remind_at（最早一项）同步；相对 start */
  reminders: z.array(calendarReminderEntrySchema).optional(),
  tag_ids: z.array(z.number().int().positive()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CalendarEventRowPayload = z.infer<typeof calendarEventRowSchema>;

export const calendarListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  range_start: z.string().optional(),
  range_end: z.string().optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type CalendarListInput = z.infer<typeof calendarListInputSchema>;
export const calendarListOutputSchema = z.object({
  items: z.array(calendarEventRowSchema),
});
export type CalendarListOutput = z.infer<typeof calendarListOutputSchema>;

export const calendarCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().optional(),
  start_at: z.string().min(1),
  end_at: z.string().nullable().optional(),
  all_day: z.boolean().optional(),
  remind_at: z.string().nullable().optional(),
  reminders: z.array(calendarReminderEntrySchema).optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type CalendarCreateInput = z.infer<typeof calendarCreateInputSchema>;
export const calendarCreateOutputSchema = z.object({ item: calendarEventRowSchema });
export type CalendarCreateOutput = z.infer<typeof calendarCreateOutputSchema>;

export const calendarPatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  start_at: z.string().min(1).optional(),
  end_at: z.string().nullable().optional(),
  all_day: z.boolean().optional(),
  remind_at: z.string().nullable().optional(),
  reminders: z.array(calendarReminderEntrySchema).optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
});
export type CalendarPatchInput = z.infer<typeof calendarPatchInputSchema>;
export const calendarPatchOutputSchema = z.object({ item: calendarEventRowSchema });
export type CalendarPatchOutput = z.infer<typeof calendarPatchOutputSchema>;

export const calendarDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int(),
});
export type CalendarDeleteInput = z.infer<typeof calendarDeleteInputSchema>;
export const calendarDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type CalendarDeleteOutput = z.infer<typeof calendarDeleteOutputSchema>;

export const calendarGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type CalendarGetInput = z.infer<typeof calendarGetInputSchema>;
export const calendarGetOutputSchema = z.object({ item: calendarEventRowSchema });
export type CalendarGetOutput = z.infer<typeof calendarGetOutputSchema>;

export const calendarConvertToTaskInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type CalendarConvertToTaskInput = z.infer<typeof calendarConvertToTaskInputSchema>;

// 避免 frames/calendar ↔ frames/task 循环：此处内联 task 行形状的关键字段
export const calendarConvertToTaskOutputSchema = z.object({
  item: z.object({
    id: z.number().int().positive(),
    title: z.string(),
    content: z.string(),
    tag_ids: z.array(z.number().int().positive()),
    status: z.enum(["pending", "completed"]),
    priority: z.enum(["high", "medium", "low", "none"]),
    start_at: z.string().nullable().optional(),
    end_at: z.string().nullable().optional(),
    due_at: z.string().nullable(),
    remind_at: z.string().nullable(),
    reminders: z.array(calendarReminderEntrySchema).optional(),
    list_id: z.number().int().positive().nullable(),
    project_id: z.number().int().positive().nullable().optional(),
    sort_order: z.number(),
    completed_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});
export type CalendarConvertToTaskOutput = z.infer<typeof calendarConvertToTaskOutputSchema>;

export const calendarRangeKindSchema = z.enum(["event", "task", "project", "holiday", "habit"]);
export type CalendarRangeKind = z.infer<typeof calendarRangeKindSchema>;

export const builtinCalendarSourceIdSchema = z.enum([
  "cn_holiday",
  "traditional",
  "international",
  "solar_term",
]);
export type BuiltinCalendarSourceIdPayload = z.infer<typeof builtinCalendarSourceIdSchema>;

export const calendarRangeEventItemSchema = z.object({
  kind: z.literal("event"),
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  all_day: z.boolean(),
  remind_at: z.string().nullable(),
  reminders: z.array(calendarReminderEntrySchema).optional(),
});

export const calendarRangeTaskItemSchema = z.object({
  kind: z.literal("task"),
  id: z.number().int().positive(),
  title: z.string(),
  /** 计划开始；日历条带用计划区间，不用 due 当地平终点 */
  start_at: z.string().nullable().optional(),
  /** 计划结束；单点时为 null */
  end_at: z.string().nullable().optional(),
  /** 截止（deadline），与计划独立 */
  due_at: z.string().nullable().optional(),
  status: z.enum(["pending", "completed"]),
  priority: z.enum(["high", "medium", "low", "none"]),
  project_id: z.number().int().positive().nullable(),
  list_id: z.number().int().positive().nullable(),
  /** 重复虚拟展开实例（非 live 计划时钟）；点击仍打开 live */
  virtual: z.boolean().optional(),
  /** 完成时间；已完成任务双轴显示用 */
  completed_at: z.string().nullable().optional(),
  /** 重复打勾历史；有则点开仍走 live series id */
  occurrence_id: z.number().int().positive().optional(),
});

export const calendarRangeProjectItemSchema = z.object({
  kind: z.literal("project"),
  id: z.number().int().positive(),
  title: z.string(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  status: z.string(),
});

/** 内置日历源合成项（只读；id 为稳定 slug，非 entity） */
export const calendarRangeHolidayItemSchema = z.object({
  kind: z.literal("holiday"),
  id: z.string().min(1),
  source: builtinCalendarSourceIdSchema,
  title: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  all_day: z.literal(true),
});

export const calendarRangeHabitItemSchema = z.object({
  kind: z.literal("habit"),
  id: z.number().int().positive(),
  title: z.string(),
  /** 当日提醒点或日界全天 */
  start_at: z.string(),
  end_at: z.string().nullable(),
  all_day: z.boolean(),
  day: z.string(),
  amount: z.number().nonnegative(),
  target: z.number().positive(),
  met: z.boolean(),
  polarity: z.enum(["build", "break"]),
  check_in_id: z.number().int().positive().nullable(),
  /** 多提醒展开时标记同一习惯同日的时间点 */
  reminder_time: z.string().nullable().optional(),
});

export const calendarRangeItemSchema = z.discriminatedUnion("kind", [
  calendarRangeEventItemSchema,
  calendarRangeTaskItemSchema,
  calendarRangeProjectItemSchema,
  calendarRangeHolidayItemSchema,
  calendarRangeHabitItemSchema,
]);
export type CalendarRangeItemPayload = z.infer<typeof calendarRangeItemSchema>;

export const calendarRangeInputSchema = z.object({
  subject_id: z.number().int().positive(),
  from: z.string().min(1),
  to: z.string().min(1),
  kinds: z.array(calendarRangeKindSchema).optional(),
  /** kinds 含 holiday 时有效；缺省 = 全部已实现内置源 */
  sources: z.array(builtinCalendarSourceIdSchema).optional(),
  /** 并入已完成任务（计划窗相交或 completed_at 落窗） */
  include_completed: z.boolean().optional(),
});
export type CalendarRangeInput = z.infer<typeof calendarRangeInputSchema>;
export const calendarRangeOutputSchema = z.object({
  items: z.array(calendarRangeItemSchema),
});
export type CalendarRangeOutput = z.infer<typeof calendarRangeOutputSchema>;

const calendarViewModeSchema = z.enum(["day", "next3", "next7", "week", "month"]);
const calendarKindPrefSchema = z.enum(["event", "task", "project", "habit"]);

export const calendarViewDisplayPrefsSchema = z.object({
  kinds: z.array(calendarKindPrefSchema),
  builtinSources: z.array(builtinCalendarSourceIdSchema),
  expandRecurrence: z.boolean(),
  showCompleted: z.boolean(),
  showEndedEvents: z.boolean(),
});

export const calendarUiPrefsSchema = z.object({
  viewMode: calendarViewModeSchema,
  byView: z.object({
    day: calendarViewDisplayPrefsSchema,
    next3: calendarViewDisplayPrefsSchema,
    next7: calendarViewDisplayPrefsSchema,
    week: calendarViewDisplayPrefsSchema,
    month: calendarViewDisplayPrefsSchema,
  }),
});
export type CalendarUiPrefsPayload = z.infer<typeof calendarUiPrefsSchema>;

export const calendarPrefsGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
});
export type CalendarPrefsGetInput = z.infer<typeof calendarPrefsGetInputSchema>;
export const calendarPrefsGetOutputSchema = z.object({
  prefs: calendarUiPrefsSchema,
});
export type CalendarPrefsGetOutput = z.infer<typeof calendarPrefsGetOutputSchema>;

export const calendarPrefsUpdateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  viewMode: calendarViewModeSchema.optional(),
  byView: z
    .object({
      day: calendarViewDisplayPrefsSchema.partial().optional(),
      next3: calendarViewDisplayPrefsSchema.partial().optional(),
      next7: calendarViewDisplayPrefsSchema.partial().optional(),
      week: calendarViewDisplayPrefsSchema.partial().optional(),
      month: calendarViewDisplayPrefsSchema.partial().optional(),
    })
    .optional(),
});
export type CalendarPrefsUpdateInput = z.infer<typeof calendarPrefsUpdateInputSchema>;
export const calendarPrefsUpdateOutputSchema = z.object({
  prefs: calendarUiPrefsSchema,
});
export type CalendarPrefsUpdateOutput = z.infer<typeof calendarPrefsUpdateOutputSchema>;
