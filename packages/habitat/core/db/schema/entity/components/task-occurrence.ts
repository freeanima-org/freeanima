import { TASK_OCCURRENCE_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { TASK_OCCURRENCE_COMPONENT };

import { z } from "zod";

/** 重复任务某一期的完成历史（不可变快照） */
export const taskOccurrenceBodySchema = z.object({
  /** → live `task_item` id */
  series_task_id: z.number().int().positive(),
  completed_at: z.string().min(1),
  /** 完成时当期 due 快照 */
  due_at: z.string().nullable().optional(),
  list_id: z.number().int().positive().nullable().optional(),
  project_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type TaskOccurrenceBody = z.infer<typeof taskOccurrenceBodySchema>;
