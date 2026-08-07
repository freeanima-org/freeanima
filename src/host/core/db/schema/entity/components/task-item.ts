import { z } from "zod";

import { taskRecurrenceSchema } from "../task-recurrence.ts";
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
  completed_at: z.string().nullable().optional(),
  project_id: z.number().int().positive().nullable().optional(),
  /**
   * 子任务父任务 id；最多一层（子任务不可再挂 parent）。
   * null/缺省 = 根任务。
   */
  parent_id: z.number().int().positive().nullable().optional(),
  client_op_id: z.string().min(1).nullable().default(null),
  /** 重复规则；null/缺省 = 非重复。完成时滚动 live，历史见 task_occurrence */
  recurrence: taskRecurrenceSchema.nullable().optional(),
});

/**
 * 归属互斥：恰好一方有值（list_id XOR project_id）。
 * 读路径预处理：
 * - 存量「进项目仍带 list_id」归一为 list_id=null
 * - 无 due_at 时剥离 recurrence / 提醒（硬约束：无日期则无重复与提醒）
 */
export const taskItemBodySchema = z.preprocess(
  (val) => {
    if (val == null || typeof val !== "object") return val;
    let obj = val as Record<string, unknown>;
    if (obj.project_id != null && obj.project_id !== "") {
      obj = { ...obj, list_id: null };
    }
    const dueEmpty = obj.due_at == null || obj.due_at === "";
    if (dueEmpty) {
      const hasRemind =
        (typeof obj.remind_at === "string" && obj.remind_at.length > 0) ||
        (Array.isArray(obj.reminders) && obj.reminders.length > 0);
      const hasRecurrence = obj.recurrence != null && obj.recurrence !== undefined;
      if (hasRemind || hasRecurrence) {
        obj = {
          ...obj,
          due_at: null,
          recurrence: null,
          remind_at: null,
          reminders: [],
        };
      }
    }
    return obj;
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
    const dueEmpty = data.due_at == null || data.due_at === "";
    if (!dueEmpty) return;
    if (data.recurrence != null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recurrence requires due_at",
        path: ["recurrence"],
      });
    }
    const hasRemind =
      (data.remind_at != null && data.remind_at !== "") ||
      (data.reminders != null && data.reminders.length > 0);
    if (hasRemind) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reminders require due_at",
        path: ["reminders"],
      });
    }
  }),
);

export type TaskItemBody = z.infer<typeof taskItemBodyFieldsSchema>;
