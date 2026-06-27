import { z } from "zod";

import {
  taskItemPrioritySchema,
  taskItemStatusSchema,
  TASK_ITEM_COMPONENT,
} from "./components/task-item.ts";

/** task_item 结构化搜索 filters（EntitySearchOpts.filters） */
export const taskItemSearchFiltersSchema = z
  .object({
    list_id: z.number().int().positive().optional(),
    status: z.union([taskItemStatusSchema, z.literal("all")]).optional(),
    priority: taskItemPrioritySchema.optional(),
    tags: z.array(z.string()).optional(),
    due_today: z.boolean().optional(),
    due_before: z.string().optional(),
    due_after: z.string().optional(),
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

export const ENTITY_SEARCH_FILTER_COMPONENTS = {
  [TASK_ITEM_COMPONENT]: taskItemSearchFiltersSchema,
} as const;
