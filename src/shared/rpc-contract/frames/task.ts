import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";

const taskSubjectKindSchema = notificationRecipientKindSchema;

const taskPrioritySchema = z.enum(["high", "medium", "low", "none"]);
const taskStatusSchema = z.enum(["pending", "completed"]);
const taskRelativeDaySchema = z.enum(["today", "tomorrow", "yesterday"]);

export const taskItemSearchFiltersSchema = z
  .object({
    list_id: z.number().int().positive().optional(),
    list_ids: z.array(z.number().int().positive()).min(1).optional(),
    status: taskStatusSchema.or(z.literal("all")).optional(),
    priority: taskPrioritySchema.optional(),
    tag_ids: z.array(z.number().int().positive()).optional(),
    due_today: z.boolean().optional(),
    due_before: z.string().optional(),
    due_after: z.string().optional(),
    has_due_at: z.boolean().optional(),
    due_on: taskRelativeDaySchema.optional(),
    due_on_or_before_days: z.number().int().nonnegative().optional(),
    completed_on: taskRelativeDaySchema.optional(),
    completed_on_or_after_days: z.number().int().nonnegative().optional(),
    project_id: z.number().int().positive().optional(),
    in_backlog: z.boolean().optional(),
  })
  .strict();

export type TaskItemSearchFiltersPayload = z.infer<typeof taskItemSearchFiltersSchema>;

const smartListPresetSchema = z.enum([
  "due_today",
  "due_tomorrow",
  "due_next_7d",
  "done_today",
  "done_yesterday",
  "done_last_7d",
]);

export const taskListRowSchema = z.object({
  id: z.number().int().positive(),
  name: z.string(),
  sort_order: z.number().int(),
  closed: z.boolean(),
  color: z.string().nullable(),
  is_default: z.boolean(),
  is_folder: z.boolean(),
  parent_id: z.number().int().positive().nullable(),
  /** 次要数据：仅 tasklist.stats 返回；list/create/patch 省略 */
  item_count: z.number().int().nonnegative().optional(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskListRowPayload = z.infer<typeof taskListRowSchema>;

export const taskItemRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  tag_ids: z.array(z.number().int().positive()),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  due_at: z.string().nullable(),
  remind_at: z.string().nullable(),
  list_id: z.number().int().positive().nullable(),
  project_id: z.number().int().positive().nullable(),
  project_title: z.string().nullable().optional(),
  list_name: z.string().nullable().optional(),
  sort_order: z.number().int(),
  completed_at: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskItemRowPayload = z.infer<typeof taskItemRowSchema>;

export const tasklistListInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  include_closed: z.boolean().optional(),
});
export type TasklistListInput = z.infer<typeof tasklistListInputSchema>;
export const tasklistListOutputSchema = z.object({
  lists: z.array(taskListRowSchema),
});
export type TasklistListOutput = z.infer<typeof tasklistListOutputSchema>;

export const tasklistStatsInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  include_closed: z.boolean().optional(),
});
export type TasklistStatsInput = z.infer<typeof tasklistStatsInputSchema>;
export const tasklistStatsOutputSchema = z.object({
  counts: z.array(
    z.object({
      id: z.number().int().positive(),
      item_count: z.number().int().nonnegative(),
    }),
  ),
});
export type TasklistStatsOutput = z.infer<typeof tasklistStatsOutputSchema>;

export const tasklistCreateInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  name: z.string().min(1),
  sort_order: z.number().int().optional(),
  color: z.string().nullable().optional(),
  is_folder: z.boolean().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TasklistCreateInput = z.infer<typeof tasklistCreateInputSchema>;
export const tasklistCreateOutputSchema = z.object({ item: taskListRowSchema });
export type TasklistCreateOutput = z.infer<typeof tasklistCreateOutputSchema>;

export const tasklistPatchInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  name: z.string().min(1).optional(),
  sort_order: z.number().int().optional(),
  closed: z.boolean().optional(),
  color: z.string().nullable().optional(),
  is_folder: z.boolean().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TasklistPatchInput = z.infer<typeof tasklistPatchInputSchema>;
export const tasklistPatchOutputSchema = z.object({ item: taskListRowSchema });
export type TasklistPatchOutput = z.infer<typeof tasklistPatchOutputSchema>;

export const tasklistDeleteInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  cascade: z.boolean().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TasklistDeleteInput = z.infer<typeof tasklistDeleteInputSchema>;
export const tasklistDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type TasklistDeleteOutput = z.infer<typeof tasklistDeleteOutputSchema>;

export const smartListRowSchema = z.object({
  id: z.number().int().positive().optional(),
  preset: smartListPresetSchema.optional(),
  title: z.string(),
  sort_order: z.number().int(),
  filters: taskItemSearchFiltersSchema,
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export type SmartListRowPayload = z.infer<typeof smartListRowSchema>;

export const smartlistListInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
});
export type SmartlistListInput = z.infer<typeof smartlistListInputSchema>;
export const smartlistListOutputSchema = z.object({
  smart_lists: z.array(smartListRowSchema),
});
export type SmartlistListOutput = z.infer<typeof smartlistListOutputSchema>;

export const smartlistStatsInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
});
export type SmartlistStatsInput = z.infer<typeof smartlistStatsInputSchema>;
export const smartlistStatsCountSchema = z.object({
  id: z.number().int().positive().optional(),
  preset: smartListPresetSchema.optional(),
  item_count: z.number().int().nonnegative(),
});
export const smartlistStatsOutputSchema = z.object({
  counts: z.array(smartlistStatsCountSchema),
});
export type SmartlistStatsOutput = z.infer<typeof smartlistStatsOutputSchema>;

export const smartlistCreateInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  title: z.string().min(1),
  filters: taskItemSearchFiltersSchema,
  sort_order: z.number().int().optional(),
});
export type SmartlistCreateInput = z.infer<typeof smartlistCreateInputSchema>;
export const smartlistCreateOutputSchema = z.object({ item: smartListRowSchema });
export type SmartlistCreateOutput = z.infer<typeof smartlistCreateOutputSchema>;

export const smartlistPatchInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  filters: taskItemSearchFiltersSchema.optional(),
  sort_order: z.number().int().optional(),
});
export type SmartlistPatchInput = z.infer<typeof smartlistPatchInputSchema>;
export const smartlistPatchOutputSchema = z.object({ item: smartListRowSchema });
export type SmartlistPatchOutput = z.infer<typeof smartlistPatchOutputSchema>;

export const smartlistDeleteInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
});
export type SmartlistDeleteInput = z.infer<typeof smartlistDeleteInputSchema>;
export const smartlistDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type SmartlistDeleteOutput = z.infer<typeof smartlistDeleteOutputSchema>;

export const taskListInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  list_id: z.number().int().positive().optional(),
  filters: taskItemSearchFiltersSchema.optional(),
  status: taskStatusSchema.or(z.literal("all")).optional(),
  due_today: z.boolean().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type TaskListInput = z.infer<typeof taskListInputSchema>;
/** @deprecated 使用 tasklistItemList*；保留类型别名兼容 */
export type TasklistItemListInput = TaskListInput;
export const tasklistItemListInputSchema = taskListInputSchema;
export const taskListOutputSchema = z.object({ items: z.array(taskItemRowSchema) });
export type TaskListOutput = z.infer<typeof taskListOutputSchema>;
export const tasklistItemListOutputSchema = taskListOutputSchema;
export type TasklistItemListOutput = TaskListOutput;

export const projectItemListInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  project_id: z.number().int().positive(),
  status: taskStatusSchema.or(z.literal("all")).optional(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type ProjectItemListInput = z.infer<typeof projectItemListInputSchema>;
export const projectItemListOutputSchema = z.object({ items: z.array(taskItemRowSchema) });
export type ProjectItemListOutput = z.infer<typeof projectItemListOutputSchema>;

/** 任务模块建任务：只认 list_id（省略则默认收件箱） */
export const tasklistItemCreateInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  title: z.string().min(1),
  list_id: z.number().int().positive().optional(),
  content: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  priority: taskPrioritySchema.optional(),
  due_at: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TasklistItemCreateInput = z.infer<typeof tasklistItemCreateInputSchema>;
export const tasklistItemCreateOutputSchema = z.object({ item: taskItemRowSchema });
export type TasklistItemCreateOutput = z.infer<typeof tasklistItemCreateOutputSchema>;

/** 项目模块建任务：只认 project_id */
export const projectItemCreateInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  title: z.string().min(1),
  project_id: z.number().int().positive(),
  content: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  priority: taskPrioritySchema.optional(),
  due_at: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type ProjectItemCreateInput = z.infer<typeof projectItemCreateInputSchema>;
export const projectItemCreateOutputSchema = z.object({ item: taskItemRowSchema });
export type ProjectItemCreateOutput = z.infer<typeof projectItemCreateOutputSchema>;

/** @deprecated 请用 tasklist.item.create / project.item.create */
export const taskCreateInputSchema = tasklistItemCreateInputSchema;
export type TaskCreateInput = TasklistItemCreateInput;
export const taskCreateOutputSchema = tasklistItemCreateOutputSchema;
export type TaskCreateOutput = TasklistItemCreateOutput;

export const taskMoveToProjectInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  project_id: z.number().int().positive(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskMoveToProjectInput = z.infer<typeof taskMoveToProjectInputSchema>;
export const taskMoveToProjectOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskMoveToProjectOutput = z.infer<typeof taskMoveToProjectOutputSchema>;

export const taskMoveToListInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  list_id: z.number().int().positive(),
  sort_order: z.number().int().optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskMoveToListInput = z.infer<typeof taskMoveToListInputSchema>;
export const taskMoveToListOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskMoveToListOutput = z.infer<typeof taskMoveToListOutputSchema>;

/** 共享内容字段 patch；归属变更请用 task.moveToProject / task.moveToList */
export const taskPatchInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  priority: taskPrioritySchema.optional(),
  due_at: z.string().nullable().optional(),
  remind_at: z.string().nullable().optional(),
  sort_order: z.number().int().optional(),
  status: taskStatusSchema.optional(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskPatchInput = z.infer<typeof taskPatchInputSchema>;
export const taskPatchOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskPatchOutput = z.infer<typeof taskPatchOutputSchema>;

export const taskCompleteInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskCompleteInput = z.infer<typeof taskCompleteInputSchema>;
export const taskCompleteOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskCompleteOutput = z.infer<typeof taskCompleteOutputSchema>;

export const taskUncompleteInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskUncompleteInput = z.infer<typeof taskUncompleteInputSchema>;
export const taskUncompleteOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskUncompleteOutput = z.infer<typeof taskUncompleteOutputSchema>;

export const taskDeleteInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskDeleteInput = z.infer<typeof taskDeleteInputSchema>;
export const taskDeleteOutputSchema = z.object({ ok: z.literal(true) });
export type TaskDeleteOutput = z.infer<typeof taskDeleteOutputSchema>;

export const taskSearchInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  query: z.string().min(1),
  list_id: z.number().int().positive().optional(),
  status: taskStatusSchema.or(z.literal("all")).optional(),
  limit: z.number().int().positive().optional(),
});
export type TaskSearchInput = z.infer<typeof taskSearchInputSchema>;
export const taskSearchOutputSchema = z.object({ items: z.array(taskItemRowSchema) });
export type TaskSearchOutput = z.infer<typeof taskSearchOutputSchema>;
