import { z } from "zod";

import { schedulableBodySchema } from "./schedulable.ts";

export const TASK_ITEM_COMPONENT = "task_item" as const;

export const taskItemStatusSchema = z.enum(["pending", "completed"]);
export type TaskItemStatus = z.infer<typeof taskItemStatusSchema>;

export const taskItemPrioritySchema = z.enum(["high", "medium", "low", "none"]);
export type TaskItemPriority = z.infer<typeof taskItemPrioritySchema>;

export const taskItemBodySchema = schedulableBodySchema.extend({
  title: z.string().min(1),
  status: taskItemStatusSchema.default("pending"),
  priority: taskItemPrioritySchema.default("none"),
  list_id: z.number().int().positive(),
  sort_order: z.number().int().optional(),
  note: z.string().nullable().optional(),
  completed_at: z.string().nullable().optional(),
});

export type TaskItemBody = z.infer<typeof taskItemBodySchema>;
