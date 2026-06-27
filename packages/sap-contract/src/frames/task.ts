import { z } from "zod";

const taskPrioritySchema = z.enum(["high", "medium", "low", "none"]);
const taskStatusSchema = z.enum(["pending", "completed"]);

export const taskListRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  sort_order: z.number().int(),
  closed: z.boolean(),
  color: z.string().nullable(),
  is_default: z.boolean(),
  item_count: z.number().int().nonnegative(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskListRowPayload = z.infer<typeof taskListRowSchema>;

export const taskItemRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  tags: z.array(z.string()),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  due_at: z.string().nullable(),
  list_id: z.number().int().positive(),
  sort_order: z.number().int(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskItemRowPayload = z.infer<typeof taskItemRowSchema>;

export const tasklistListInputSchema = z.object({}).default({});
export type TasklistListInput = z.infer<typeof tasklistListInputSchema>;
export const tasklistListOutputSchema = z.object({
  lists: z.array(taskListRowSchema),
});
export type TasklistListOutput = z.infer<typeof tasklistListOutputSchema>;

export const tasklistCreateInputSchema = z.object({
  name: z.string().min(1),
  sort_order: z.number().int().optional(),
  color: z.string().nullable().optional(),
});
export type TasklistCreateInput = z.infer<typeof tasklistCreateInputSchema>;
export const tasklistCreateOutputSchema = z.object({ item: taskListRowSchema });
export type TasklistCreateOutput = z.infer<typeof tasklistCreateOutputSchema>;

export const tasklistPatchInputSchema = z.object({
  id: z.number().int().positive(),
  name: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
  closed: z.boolean().optional(),
  color: z.string().nullable().optional(),
});
export type TasklistPatchInput = z.infer<typeof tasklistPatchInputSchema>;
export const tasklistPatchOutputSchema = z.object({ item: taskListRowSchema });
export type TasklistPatchOutput = z.infer<typeof tasklistPatchOutputSchema>;

export const tasklistDeleteInputSchema = z.object({
  id: z.number().int().positive(),
  cascade: z.boolean().optional(),
});
export type TasklistDeleteInput = z.infer<typeof tasklistDeleteInputSchema>;
export const tasklistDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type TasklistDeleteOutput = z.infer<typeof tasklistDeleteOutputSchema>;

export const taskListInputSchema = z.object({
  list_id: z.number().int().positive().optional(),
  status: taskStatusSchema.or(z.literal("all")).optional(),
  due_today: z.boolean().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type TaskListInput = z.infer<typeof taskListInputSchema>;
export const taskListOutputSchema = z.object({ items: z.array(taskItemRowSchema) });
export type TaskListOutput = z.infer<typeof taskListOutputSchema>;

export const taskCreateInputSchema = z.object({
  title: z.string().min(1),
  list_id: z.number().int().positive(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: taskPrioritySchema.optional(),
  due_at: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
});
export type TaskCreateInput = z.infer<typeof taskCreateInputSchema>;
export const taskCreateOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskCreateOutput = z.infer<typeof taskCreateOutputSchema>;

export const taskPatchInputSchema = z.object({
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  list_id: z.number().int().positive().optional(),
  content: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: taskPrioritySchema.optional(),
  due_at: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  status: taskStatusSchema.optional(),
});
export type TaskPatchInput = z.infer<typeof taskPatchInputSchema>;
export const taskPatchOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskPatchOutput = z.infer<typeof taskPatchOutputSchema>;

export const taskCompleteInputSchema = z.object({
  id: z.number().int().positive(),
});
export type TaskCompleteInput = z.infer<typeof taskCompleteInputSchema>;
export const taskCompleteOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskCompleteOutput = z.infer<typeof taskCompleteOutputSchema>;

export const taskUncompleteInputSchema = z.object({
  id: z.number().int().positive(),
});
export type TaskUncompleteInput = z.infer<typeof taskUncompleteInputSchema>;
export const taskUncompleteOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskUncompleteOutput = z.infer<typeof taskUncompleteOutputSchema>;

export const taskDeleteInputSchema = z.object({
  id: z.number().int().positive(),
});
export type TaskDeleteInput = z.infer<typeof taskDeleteInputSchema>;
export const taskDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type TaskDeleteOutput = z.infer<typeof taskDeleteOutputSchema>;
