import { z } from "zod";

import { schedulableBodySchema } from "./schedulable.ts";

export const TASK_ITEM_COMPONENT = "task_item" as const;

export const taskItemStatusSchema = z.enum(["pending", "completed"]);
export type TaskItemStatus = z.infer<typeof taskItemStatusSchema>;

export const taskItemPrioritySchema = z.enum(["high", "medium", "low", "none"]);
export type TaskItemPriority = z.infer<typeof taskItemPrioritySchema>;

const taskItemBodyFieldsSchema = schedulableBodySchema.extend({
  status: taskItemStatusSchema.default("pending"),
  priority: taskItemPrioritySchema.default("none"),
  /** 任务模块必填；项目内为 null（与 project_id 互斥） */
  list_id: z.number().int().positive().nullable(),
  sort_order: z.number().int().optional(),
  tags: z.array(z.string()).default([]),
  completed_at: z.string().nullable().optional(),
  project_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
});

/**
 * 归属互斥：恰好一方有值（list_id XOR project_id）。
 * 读路径预处理：存量「进项目仍带 list_id」归一为 list_id=null。
 */
export const taskItemBodySchema = z.preprocess(
  (val) => {
    if (val == null || typeof val !== "object") return val;
    const obj = val as Record<string, unknown>;
    if (obj.project_id != null && obj.project_id !== "") {
      return { ...obj, list_id: null };
    }
    return val;
  },
  taskItemBodyFieldsSchema.superRefine((data, ctx) => {
    const hasList = data.list_id != null;
    const hasProject = data.project_id != null;
    if (hasList === hasProject) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "exactly one of list_id or project_id required",
        path: hasList ? ["project_id"] : ["list_id"],
      });
    }
  }),
);

export type TaskItemBody = z.infer<typeof taskItemBodyFieldsSchema>;
