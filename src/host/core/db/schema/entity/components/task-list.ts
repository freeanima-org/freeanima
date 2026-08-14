import { TASK_LIST_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { TASK_LIST_COMPONENT };

import { z } from "zod";

export const taskListBodySchema = z.object({
  sort_order: z.number().int().optional(),
  closed: z.boolean().optional(),
  color: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
  /** 文件夹容器，不可作为 task_item.list_id 目标 */
  is_folder: z.boolean().optional(),
  /** 父文件夹 entity id；null 表示根级 */
  parent_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type TaskListBody = z.infer<typeof taskListBodySchema>;
