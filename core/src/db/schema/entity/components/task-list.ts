import { z } from "zod";

export const TASK_LIST_COMPONENT = "task_list" as const;

export const taskListBodySchema = z.object({
  sort_order: z.number().int().optional(),
  closed: z.boolean().optional(),
  color: z.string().nullable().optional(),
  is_default: z.boolean().optional(),
});

export type TaskListBody = z.infer<typeof taskListBodySchema>;
