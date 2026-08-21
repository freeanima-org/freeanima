import { isRecord } from "@freeanima/shared/util";
import { z } from "zod";

import { taskRecurrenceSchema } from "../task-recurrence.ts";
import {
  hasTaskPlan,
  hasTaskScheduleTime,
  nonEmptyIso,
  schedulableBodySchema,
  taskPlanClock,
} from "./schedulable.ts";
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
 * - 无计划且无 due 时剥离 recurrence / 提醒
 * - 旧 due→计划 仅由 PG migration 完成（不可在读路径猜：新模型允许「仅 due」为真 deadline）
 */
export const taskItemBodySchema = z.preprocess(
  (val) => {
    if (!isRecord(val)) return val;
    let obj = { ...val };
    if (obj.project_id != null && obj.project_id !== "") {
      obj = { ...obj, list_id: null };
    }

    // 有 end 无 start：先丢弃孤立 end（再算计划/约束）
    if (nonEmptyIso(obj.end_at) != null && nonEmptyIso(obj.start_at) == null) {
      obj = { ...obj, end_at: null };
    }

    const hasSchedule = hasTaskScheduleTime({
      start_at: nonEmptyIso(obj.start_at),
      end_at: nonEmptyIso(obj.end_at),
      due_at: nonEmptyIso(obj.due_at),
    });
    if (!hasSchedule) {
      const hasRemind =
        (typeof obj.remind_at === "string" && obj.remind_at.length > 0) ||
        (Array.isArray(obj.reminders) && obj.reminders.length > 0);
      const hasRecurrence = obj.recurrence != null && obj.recurrence !== undefined;
      if (hasRemind || hasRecurrence) {
        obj = {
          ...obj,
          recurrence: null,
          remind_at: null,
          reminders: [],
        };
      }
    } else if (
      !hasTaskPlan({ start_at: nonEmptyIso(obj.start_at), end_at: nonEmptyIso(obj.end_at) })
    ) {
      // 仅 deadline：不允许重复（重复绑计划时钟）
      if (obj.recurrence != null && obj.recurrence !== undefined) {
        obj = { ...obj, recurrence: null };
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

    const start = nonEmptyIso(data.start_at);
    const end = nonEmptyIso(data.end_at);
    if (end != null && start == null) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "end_at requires start_at",
        path: ["end_at"],
      });
    }
    if (start != null && end != null) {
      const startMs = Date.parse(start);
      const endMs = Date.parse(end);
      if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "start_at must be <= end_at",
          path: ["start_at"],
        });
      }
    }

    const hasPlan = hasTaskPlan({ start_at: start, end_at: end });
    const hasSchedule = hasTaskScheduleTime({
      start_at: start,
      end_at: end,
      due_at: data.due_at,
    });

    if (data.recurrence != null && !hasPlan) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "recurrence requires planned time (start_at)",
        path: ["recurrence"],
      });
    }

    const hasRemind =
      (data.remind_at != null && data.remind_at !== "") ||
      (data.reminders != null && data.reminders.length > 0);
    if (hasRemind && !hasSchedule) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "reminders require planned time or due_at",
        path: ["reminders"],
      });
    }

    // 静默：taskPlanClock 供调用方；此处确保字段合法即可
    void taskPlanClock({ start_at: start, end_at: end });
  }),
);

export type TaskItemBody = z.infer<typeof taskItemBodyFieldsSchema>;
