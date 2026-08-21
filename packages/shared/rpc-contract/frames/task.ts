import { z } from "zod";

import { notificationRecipientKindSchema } from "./notification.ts";
import {
  taskItemPrioritySchema,
  taskItemStatusSchema,
  taskContainerSchema,
} from "@freeanima/shared/pg-shapes/entity/enums.ts";
import {
  taskRecurrenceSchema,
  taskRecurrenceInputSchema,
  type TaskRecurrence,
  type TaskRecurrenceInput,
} from "@freeanima/shared/pg-shapes/entity/task-recurrence.ts";

const taskSubjectKindSchema = notificationRecipientKindSchema;

const taskPrioritySchema = taskItemPrioritySchema;
const taskStatusSchema = taskItemStatusSchema;
const taskRelativeDaySchema = z.enum(["today", "tomorrow", "yesterday"]);

export { taskRecurrenceSchema, taskRecurrenceInputSchema };
export type TaskRecurrencePayload = TaskRecurrence;
export type TaskRecurrenceInputPayload = TaskRecurrenceInput;

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
    /** 有计划开始（start_at） */
    has_start_at: z.boolean().optional(),
    /**
     * 计划结束时刻上界（不含）：COALESCE(end_at, start_at) < plan_before。
     * 议程「计划逾期」常用今天 00:00。
     */
    plan_before: z.string().optional(),
    completed_on: taskRelativeDaySchema.optional(),
    completed_on_or_after_days: z.number().int().nonnegative().optional(),
    completed_after: z.string().optional(),
    completed_before: z.string().optional(),
    project_id: z.number().int().positive().optional(),
    container: taskContainerSchema.optional(),
    /** @deprecated 用 container */
    in_backlog: z.boolean().optional(),
    parent_id: z.number().int().positive().optional(),
    roots_only: z.boolean().optional(),
  })
  .strict();

export type TaskItemSearchFiltersPayload = z.infer<typeof taskItemSearchFiltersSchema>;

const smartListPresetSchema = z.enum(["done_today", "done_yesterday", "done_last_7d"]);

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

const taskReminderAnchorSchema = z.enum(["start", "end", "due"]);

const taskReminderEntrySchema = z.object({
  at: z.string().min(1),
  /** 相对哪类时间锚点；缺省由读写路径补 */
  anchor: taskReminderAnchorSchema.optional(),
  last_notified_at: z.string().nullable().optional(),
});

export const taskItemRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  tag_ids: z.array(z.number().int().positive()),
  status: taskStatusSchema,
  priority: taskPrioritySchema,
  /** 计划开始；单点或时段起点 */
  start_at: z.string().nullable().optional(),
  /** 计划结束；单点时为 null */
  end_at: z.string().nullable().optional(),
  /** 截止（deadline），与计划独立；Inbox「到期」仅看本字段 */
  due_at: z.string().nullable(),
  remind_at: z.string().nullable(),
  /** 多提前提醒；与 remind_at（最早一项）同步；可锚 start/end/due */
  reminders: z.array(taskReminderEntrySchema).optional(),
  list_id: z.number().int().positive().nullable(),
  project_id: z.number().int().positive().nullable(),
  project_title: z.string().nullable().optional(),
  list_name: z.string().nullable().optional(),
  sort_order: z.number().int(),
  completed_at: z.string().nullable(),
  recurrence: taskRecurrenceSchema.nullable().optional(),
  /** 若有值，本行是重复任务完成历史快照；id 为 series live id */
  occurrence_id: z.number().int().positive().optional(),
  /** 子任务父 id；根任务为 null */
  parent_id: z.number().int().positive().nullable().optional(),
  /** 子任务完成进度（仅根任务列表可选填充） */
  subtask_done: z.number().int().nonnegative().optional(),
  subtask_total: z.number().int().nonnegative().optional(),
  /**
   * 实体 primary_component。非 `task_item` 时表示挂载 facet（如邮件），
   * 删除只卸组件（见 `taskDeleteDetachesCarrier`）。
   */
  primary_component: z.string().min(1),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskItemRowPayload = z.infer<typeof taskItemRowSchema>;

export const taskOccurrenceRowSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string(),
  series_task_id: z.number().int().positive(),
  completed_at: z.string(),
  due_at: z.string().nullable(),
  list_id: z.number().int().positive().nullable(),
  project_id: z.number().int().positive().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type TaskOccurrenceRowPayload = z.infer<typeof taskOccurrenceRowSchema>;

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
  /** 只列根任务（默认 true）；false 可列全部；指定 parent_id 时列该父下子任务 */
  roots_only: z.boolean().optional(),
  parent_id: z.number().int().positive().optional(),
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
  /** 计划开始 */
  start_at: z.string().nullable().optional(),
  /** 计划结束；单点时为 null */
  end_at: z.string().nullable().optional(),
  /** 截止（deadline） */
  due_at: z.string().nullable().optional(),
  remind_at: z.string().nullable().optional(),
  reminders: z.array(taskReminderEntrySchema).optional(),
  recurrence: taskRecurrenceInputSchema.nullable().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
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
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  remind_at: z.string().nullable().optional(),
  reminders: z.array(taskReminderEntrySchema).optional(),
  recurrence: taskRecurrenceInputSchema.nullable().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
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

/** 按 id 取单条任务（含清单/backlog 与项目内） */
export const taskGetInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
});
export type TaskGetInput = z.infer<typeof taskGetInputSchema>;
export const taskGetOutputSchema = z.object({ item: taskItemRowSchema.nullable() });
export type TaskGetOutput = z.infer<typeof taskGetOutputSchema>;

/** 共享内容字段 patch；归属变更请用 task.moveToProject / task.moveToList */
export const taskPatchInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  title: z.string().min(1).optional(),
  content: z.string().optional(),
  tag_ids: z.array(z.number().int().positive()).optional(),
  priority: taskPrioritySchema.optional(),
  start_at: z.string().nullable().optional(),
  end_at: z.string().nullable().optional(),
  due_at: z.string().nullable().optional(),
  remind_at: z.string().nullable().optional(),
  reminders: z.array(taskReminderEntrySchema).optional(),
  sort_order: z.number().int().optional(),
  status: taskStatusSchema.optional(),
  recurrence: taskRecurrenceInputSchema.nullable().optional(),
  parent_id: z.number().int().positive().nullable().optional(),
  /** 有 recurrence 时改计划时钟：true=仅此一次；缺省=改规则轨 */
  only_this: z.boolean().optional(),
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

export const taskSkipInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskSkipInput = z.infer<typeof taskSkipInputSchema>;
export const taskSkipOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskSkipOutput = z.infer<typeof taskSkipOutputSchema>;

export const taskCompleteForeverInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
  client_op_id: z.string().min(1).optional(),
});
export type TaskCompleteForeverInput = z.infer<typeof taskCompleteForeverInputSchema>;
export const taskCompleteForeverOutputSchema = z.object({ item: taskItemRowSchema });
export type TaskCompleteForeverOutput = z.infer<typeof taskCompleteForeverOutputSchema>;

export const taskListOccurrencesInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  series_task_id: z.number().int().positive(),
  limit: z.number().int().positive().optional(),
  offset: z.number().int().nonnegative().optional(),
});
export type TaskListOccurrencesInput = z.infer<typeof taskListOccurrencesInputSchema>;
export const taskListOccurrencesOutputSchema = z.object({
  items: z.array(taskOccurrenceRowSchema),
});
export type TaskListOccurrencesOutput = z.infer<typeof taskListOccurrencesOutputSchema>;

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

export const taskConvertToEventInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  id: z.number().int().positive(),
});
export type TaskConvertToEventInput = z.infer<typeof taskConvertToEventInputSchema>;
export const taskConvertToEventOutputSchema = z.object({
  item: z.object({
    id: z.number().int().positive(),
    title: z.string(),
    content: z.string(),
    start_at: z.string(),
    end_at: z.string().nullable(),
    all_day: z.boolean(),
    remind_at: z.string().nullable(),
    reminders: z.array(taskReminderEntrySchema).optional(),
    tag_ids: z.array(z.number().int().positive()),
    created_at: z.string(),
    updated_at: z.string(),
  }),
});
export type TaskConvertToEventOutput = z.infer<typeof taskConvertToEventOutputSchema>;

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

export const taskSubscribeAdvanceRemindersInputSchema = z.object({}).passthrough();
export type TaskSubscribeAdvanceRemindersInput = z.infer<
  typeof taskSubscribeAdvanceRemindersInputSchema
>;
export const taskSubscribeAdvanceRemindersOutputSchema = z.object({ ok: z.literal(true) });
export type TaskSubscribeAdvanceRemindersOutput = z.infer<
  typeof taskSubscribeAdvanceRemindersOutputSchema
>;

export const taskAdvanceReminderEventSchema = z.object({
  task_item_id: z.number().int().positive(),
  title: z.string(),
  body: z.string(),
  at: z.string(),
  source_ref: z.string(),
});
export type TaskAdvanceReminderEvent = z.infer<typeof taskAdvanceReminderEventSchema>;

/** 滴答清单 CSV 备份导入 */
export const taskImportDidaCsvInputSchema = z.object({
  subject_kind: taskSubjectKindSchema,
  csv_text: z.string().min(1),
  mode: z.enum(["upsert", "create_only"]).optional(),
});
export type TaskImportDidaCsvInput = z.infer<typeof taskImportDidaCsvInputSchema>;
export const taskImportDidaCsvOutputSchema = z.object({
  created_lists: z.number().int().nonnegative(),
  updated_lists: z.number().int().nonnegative(),
  created_tasks: z.number().int().nonnegative(),
  updated_tasks: z.number().int().nonnegative(),
  skipped: z.number().int().nonnegative(),
  abandoned_skipped: z.number().int().nonnegative(),
  warnings: z.array(z.string()),
  errors: z.array(z.string()),
});
export type TaskImportDidaCsvOutput = z.infer<typeof taskImportDidaCsvOutputSchema>;
