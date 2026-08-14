import { z } from "zod";

import { taskRelativeDaySchema } from "./task-item-search-filters.ts";

/** task_occurrence 结构化搜索 filters */
export const taskOccurrenceSearchFiltersSchema = z
  .object({
    series_task_id: z.number().int().positive().optional(),
    list_id: z.number().int().positive().optional(),
    list_ids: z.array(z.number().int().positive()).min(1).optional(),
    project_id: z.number().int().positive().optional(),
    in_backlog: z.boolean().optional(),
    completed_on: taskRelativeDaySchema.optional(),
    completed_on_or_after_days: z.number().int().nonnegative().optional(),
    client_op_id: z.string().min(1).optional(),
  })
  .strict();

export type TaskOccurrenceSearchFilters = z.infer<typeof taskOccurrenceSearchFiltersSchema>;

export function parseTaskOccurrenceSearchFilters(
  raw: Record<string, unknown> | undefined,
): TaskOccurrenceSearchFilters {
  if (!raw || Object.keys(raw).length === 0) return {};
  const parsed = taskOccurrenceSearchFiltersSchema.safeParse(raw);
  if (!parsed.success) {
    throw new Error(`invalid task_occurrence filters: ${parsed.error.message}`);
  }
  return parsed.data;
}
