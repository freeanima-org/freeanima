import { z } from "zod";

export const TASK_LIST_COMPONENT = "task_list" as const;

export const taskListBodySchema = z.object({
  name: z.string().min(1),
  sort_order: z.number().int().optional(),
  closed: z.boolean().optional(),
  color: z.string().nullable().optional(),
});

export type TaskListBody = z.infer<typeof taskListBodySchema>;
