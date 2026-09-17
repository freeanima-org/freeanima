import { z } from "zod";

import { taskContainerSchema } from "@freeanima/shared/pg-shapes/entity/enums.ts";
import { taskRelativeDaySchema } from "./task-item-search-filters.ts";

/** task_occurrence 结构化搜索 filters */
export const taskOccurrenceSearchFiltersSchema = z
  .object({
    series_task_id: z.number().int().positive().optional(),
    list_id: z.number().int().positive().optional(),
    list_ids: z.array(z.number().int().positive()).min(1).optional(),
    project_id: z.number().int().positive().optional(),
    container: taskContainerSchema.optional(),
    /** @deprecated 用 container。true→list，false→any */
    in_backlog: z.boolean().optional(),
    completed_on: taskRelativeDaySchema.optional(),
    completed_on_or_after_days: z.number().int().nonnegative().optional(),
    /** 绝对完成时间下界（含）；ISO8601 */
    completed_after: z.string().optional(),
    /** 绝对完成时间上界（不含）；ISO8601 */
    completed_before: z.string().optional(),
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
