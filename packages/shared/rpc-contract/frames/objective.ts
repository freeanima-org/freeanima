import { z } from "zod";

export const objectiveStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
  "cancelled",
  "on_hold",
]);

export const objectiveLinkKindSchema = z.enum([
  "project",
  "task_item",
  "task_list",
  "calendar_event",
]);

export const objectiveLinkSchema = z.object({
  kind: objectiveLinkKindSchema,
  id: z.number().int().positive(),
});

export const objectivePomodoroFilterSchema = z.object({
  task_ids: z.array(z.number().int().positive()).optional(),
  count_by: z.enum(["sessions", "minutes"]),
});

export const objectiveAutoSourceSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tasks_completed"),
    task_ids: z.array(z.number().int().positive()),
  }),
  z.object({
    type: z.literal("projects_completed"),
    project_ids: z.array(z.number().int().positive()),
  }),
  z.object({
    type: z.literal("pomodoro"),
    filter: objectivePomodoroFilterSchema,
  }),
  /** 直系子目标完成率：读侧按 parent_id 现算，无需 id 列表 */
  z.object({
    type: z.literal("children_completed"),
  }),
  z.object({
    type: z.literal("habit"),
    habit_id: z.number().int().positive(),
  }),
]);

export const objectiveCompletionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("qualitative") }),
  z.object({
    kind: z.literal("metric_manual"),
    unit: z.string().min(1),
    target: z.number(),
    current: z.number(),
  }),
  z.object({
    kind: z.literal("metric_auto"),
    unit: z.string().min(1),
    target: z.number(),
    source: objectiveAutoSourceSchema,
  }),
]);

export const objectiveResolvedProgressSchema = z.object({
  current: z.number(),
  target: z.number(),
  unit: z.string(),
  ratio: z.number().nullable(),
  source: z.enum([
    "manual",
    "tasks_completed",
    "projects_completed",
    "pomodoro",
    "children_completed",
    "habit",
    "none",
  ]),
});

export const objectiveRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  parent_id: z.number().int().positive().nullable(),
  status: objectiveStatusSchema,
  start_at: z.string().nullable(),
  end_at: z.string().nullable(),
  completion: objectiveCompletionSchema,
  links: z.array(objectiveLinkSchema),
  sort_order: z.number().int(),
  resolved_progress: objectiveResolvedProgressSchema.optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type ObjectiveRowPayload = z.infer<typeof objectiveRowSchema>;
export type ObjectiveCompletionPayload = z.infer<typeof objectiveCompletionSchema>;
export type ObjectiveResolvedProgressPayload = z.infer<typeof objectiveResolvedProgressSchema>;
export type ObjectiveLinkPayload = z.infer<typeof objectiveLinkSchema>;
export type ObjectiveStatusPayload = z.infer<typeof objectiveStatusSchema>;

export const objectiveListInputSchema = z.object({
  subject_id: z.number().int().positive(),
  parent_id: z.number().int().positive().nullable().optional(),
  status: objectiveStatusSchema.optional(),
  /** 为 true 时包含已完成/取消/暂停；默认仅未开始+进行中 */
  include_inactive: z.boolean().optional(),
});
export type ObjectiveListInput = z.infer<typeof objectiveListInputSchema>;
export const objectiveListOutputSchema = z.object({
  items: z.array(objectiveRowSchema),
});
export type ObjectiveListOutput = z.infer<typeof objectiveListOutputSchema>;

export const objectiveGetInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type ObjectiveGetInput = z.infer<typeof objectiveGetInputSchema>;
export const objectiveGetOutputSchema = z.object({ item: objectiveRowSchema });
export type ObjectiveGetOutput = z.infer<typeof objectiveGetOutputSchema>;

export const objectiveCreateInputSchema = z.object({
  subject_id: z.number().int().positive(),
  title: z.string().min(1),
  content: z.string().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  status: objectiveStatusSchema.optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  completion: objectiveCompletionSchema.optional(),
  links: z.array(objectiveLinkSchema).optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type ObjectiveCreateInput = z.infer<typeof objectiveCreateInputSchema>;
export const objectiveCreateOutputSchema = z.object({ item: objectiveRowSchema });
export type ObjectiveCreateOutput = z.infer<typeof objectiveCreateOutputSchema>;

export const objectivePatchInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  status: objectiveStatusSchema.optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  completion: objectiveCompletionSchema.optional(),
  links: z.array(objectiveLinkSchema).optional(),
  sort_order: z.number().int().optional(),
});
export type ObjectivePatchInput = z.infer<typeof objectivePatchInputSchema>;
export const objectivePatchOutputSchema = z.object({ item: objectiveRowSchema });
export type ObjectivePatchOutput = z.infer<typeof objectivePatchOutputSchema>;

export const objectiveDeleteInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
});
export type ObjectiveDeleteInput = z.infer<typeof objectiveDeleteInputSchema>;
export const objectiveDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type ObjectiveDeleteOutput = z.infer<typeof objectiveDeleteOutputSchema>;

export const objectiveLinkInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  link: objectiveLinkSchema,
});
export type ObjectiveLinkInput = z.infer<typeof objectiveLinkInputSchema>;
export const objectiveLinkOutputSchema = z.object({ item: objectiveRowSchema });
export type ObjectiveLinkOutput = z.infer<typeof objectiveLinkOutputSchema>;

export const objectiveUnlinkInputSchema = z.object({
  subject_id: z.number().int().positive(),
  id: z.number().int().positive(),
  link: objectiveLinkSchema,
});
export type ObjectiveUnlinkInput = z.infer<typeof objectiveUnlinkInputSchema>;
export const objectiveUnlinkOutputSchema = z.object({ item: objectiveRowSchema });
export type ObjectiveUnlinkOutput = z.infer<typeof objectiveUnlinkOutputSchema>;
