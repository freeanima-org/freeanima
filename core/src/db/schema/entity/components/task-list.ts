import { z } from "zod";

export const TASK_LIST_COMPONENT = "task_list" as const;

export const taskListBodySchema = z.object({
  sort_order: z.number().int().optional(),
  closed: z.boolean().optional(),
  color: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
  /** 文件夹容器，不可作为 task_item.list_id 目标 */
  is_folder: z.boolean().optional(),
  /** 父文件夹 entity id；null 表示根级 */
  parent_id: z.number().int().positive().nullable().optional(),
});

export type TaskListBody = z.infer<typeof taskListBodySchema>;
