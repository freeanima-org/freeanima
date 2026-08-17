import { CALENDAR_EVENT_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { CALENDAR_EVENT_COMPONENT };

import { z } from "zod";

import { plannedTimeBodySchema, reminderBodySchema } from "./schedulable.ts";

/** 事件：仅计划时间 + 提醒（相对开始）；无 due_at */
export const calendarEventBodySchema = plannedTimeBodySchema
  .merge(reminderBodySchema)
  .extend({
    start_at: z.string().min(1),
    end_at: z.string().nullable().default(null),
    all_day: z.boolean().default(false),
    client_op_id: z.string().min(1).nullable().default(null),
  })
  .superRefine((data, ctx) => {
    const end = data.end_at != null && data.end_at !== "" ? data.end_at : null;
    if (end == null) return;
    const startMs = Date.parse(data.start_at);
    const endMs = Date.parse(end);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "start_at must be <= end_at",
        path: ["end_at"],
      });
    }
  });

export type CalendarEventBody = z.infer<typeof calendarEventBodySchema>;
