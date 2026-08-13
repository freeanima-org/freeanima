import { z } from "zod";

import { taskRecurrenceSchema } from "../task-recurrence.ts";
import { schedulableBodySchema } from "./schedulable.ts";
import { TASK_ITEM_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export {
  taskItemStatusSchema,
  taskItemPrioritySchema,
  type TaskItemStatus,
  type TaskItemPriority,
} from "@freeanima/shared/pg-shapes/entity/enums.ts";
import {
  taskItemStatusSchema,
  taskItemPrioritySchema,
} from "@freeanima/shared/pg-shapes/entity/enums.ts";

export { TASK_ITEM_COMPONENT };

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
      // 无 due 时不保留孤立 start_at
      if (obj.start_at != null && obj.start_at !== "") {
        obj = { ...obj, start_at: null };
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
    const start = data.start_at != null && data.start_at !== "" ? data.start_at : null;
    if (start != null && dueEmpty) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start_at requires due_at",
        path: ["start_at"],
      });
    }
    if (start != null && !dueEmpty && data.due_at) {
      const startMs = Date.parse(start);
      const dueMs = Date.parse(data.due_at);
      if (Number.isFinite(startMs) && Number.isFinite(dueMs) && startMs > dueMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "start_at must be <= due_at",
          path: ["start_at"],
        });
      }
    }
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
