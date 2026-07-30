import { z } from "zod";

import { taskItemPrioritySchema, taskItemStatusSchema } from "./components/task-item.ts";

/** 相对 CST 日历日（Asia/Shanghai） */
export const taskRelativeDaySchema = z.enum(["today", "tomorrow", "yesterday"]);

/** task_item 结构化搜索 filters（EntitySearchOpts.filters / smart_list.body.filters） */
export const taskItemSearchFiltersSchema = z
  .object({
    list_id: z.number().int().positive().optional(),
    /** 限定多个 task_list（不含文件夹）；与 list_id 互斥时优先 list_ids */
    list_ids: z.array(z.number().int().positive()).min(1).optional(),
    status: z.union([taskItemStatusSchema, z.literal("all")]).optional(),
    priority: taskItemPrioritySchema.optional(),
    tag_ids: z.array(z.number().int().positive()).optional(),
    due_today: z.boolean().optional(),
    due_before: z.string().optional(),
    due_after: z.string().optional(),
    has_due_at: z.boolean().optional(),
    due_on: taskRelativeDaySchema.optional(),
    /** 相对今天（CST）的天数上限；0 = 今天及已过期 */
    due_on_or_before_days: z.number().int().nonnegative().optional(),
    completed_on: taskRelativeDaySchema.optional(),
    /** 相对今天（CST）向前 N 天起（含今天）；6 = 最近 7 个自然日 */
    completed_on_or_after_days: z.number().int().nonnegative().optional(),
    /** 限定归属项目 entity id */
    project_id: z.number().int().positive().optional(),
    /** true = 仅未归属项目的任务（Backlog） */
    in_backlog: z.boolean().optional(),
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type TaskItemSearchFilters = z.infer<typeof taskItemSearchFiltersSchema>;

export function parseTaskItemSearchFilters(
  raw: Record<string, unknown> | undefined,
): TaskItemSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = taskItemSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid task_item filters: ${parsed.error.message}`);
  }
  return parsed.data;
}
