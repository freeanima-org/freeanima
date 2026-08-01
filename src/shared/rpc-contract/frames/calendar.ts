import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

export const calendarEventRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  all_day: z.boolean(),
  remind_at: z.string().nullable(),
  tag_ids: z.array(z.number().int().positive()),
  created_at: z.string(),
  updated_at: z.string(),
});

export type CalendarEventRowPayload = z.infer<typeof calendarEventRowSchema>;

export const calendarListInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
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
  subject_kind: notificationRecipientKindSchema,
  title: z.string().min(1),
  content: z.string().optional(),
  start_at: z.string().min(1),
  end_at: z.string().nullable().optional(),
  all_day: z.boolean().optional(),
  remind_at: z.string().nullable().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type CalendarCreateInput = z.infer<typeof calendarCreateInputSchema>;
export const calendarCreateOutputSchema = z.object({ item: calendarEventRowSchema });
export type CalendarCreateOutput = z.infer<typeof calendarCreateOutputSchema>;

export const calendarPatchInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  start_at: z.string().min(1).optional(),
  end_at: z.string().nullable().optional(),
  all_day: z.boolean().optional(),
  remind_at: z.string().nullable().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  client_op_id: z.string().min(1).optional(),
});
export type CalendarPatchInput = z.infer<typeof calendarPatchInputSchema>;
export const calendarPatchOutputSchema = z.object({ item: calendarEventRowSchema });
export type CalendarPatchOutput = z.infer<typeof calendarPatchOutputSchema>;

export const calendarDeleteInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int(),
  client_op_id: z.string().min(1).optional(),
});
export type CalendarDeleteInput = z.infer<typeof calendarDeleteInputSchema>;
export const calendarDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type CalendarDeleteOutput = z.infer<typeof calendarDeleteOutputSchema>;

export const calendarGetInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  id: z.number().int().positive(),
});
export type CalendarGetInput = z.infer<typeof calendarGetInputSchema>;
export const calendarGetOutputSchema = z.object({ item: calendarEventRowSchema });
export type CalendarGetOutput = z.infer<typeof calendarGetOutputSchema>;

export const calendarRangeKindSchema = z.enum(["event", "task", "project"]);
export type CalendarRangeKind = z.infer<typeof calendarRangeKindSchema>;

export const calendarRangeEventItemSchema = z.object({
  kind: z.literal("event"),
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  start_at: z.string(),
  end_at: z.string().nullable(),
  all_day: z.boolean(),
  remind_at: z.string().nullable(),
});

export const calendarRangeTaskItemSchema = z.object({
  kind: z.literal("task"),
  id: z.number().int().positive(),
  title: z.string(),
  due_at: z.string(),
  status: z.enum(["pending", "completed"]),
  project_id: z.number().int().positive().nullable(),
  list_id: z.number().int().positive().nullable(),
  /** 重复虚拟展开实例（非 live due）；点击仍打开 live */
  virtual: z.boolean().optional(),
});

export const calendarRangeProjectItemSchema = z.object({
  kind: z.literal("project"),
  id: z.number().int().positive(),
  title: z.string(),
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  status: z.string(),
});

export const calendarRangeItemSchema = z.discriminatedUnion("kind", [
  calendarRangeEventItemSchema,
  calendarRangeTaskItemSchema,
  calendarRangeProjectItemSchema,
]);
export type CalendarRangeItemPayload = z.infer<typeof calendarRangeItemSchema>;

export const calendarRangeInputSchema = z.object({
  subject_kind: notificationRecipientKindSchema,
  from: z.string().min(1),
  to: z.string().min(1),
  kinds: z.array(calendarRangeKindSchema).optional(),
});
export type CalendarRangeInput = z.infer<typeof calendarRangeInputSchema>;
export const calendarRangeOutputSchema = z.object({
  items: z.array(calendarRangeItemSchema),
});
export type CalendarRangeOutput = z.infer<typeof calendarRangeOutputSchema>;
