import { z } from "zod";

import { schedulableBodySchema } from "./schedulable.ts";

export const CALENDAR_EVENT_COMPONENT = "calendar_event" as const;

export const calendarEventBodySchema = schedulableBodySchema.extend({
  start_at: z.string().min(1),
  end_at: z.string().nullable().default(null),
  all_day: z.boolean().default(false),
  client_op_id: z.string().min(1).nullable().default(null),
});

export type CalendarEventBody = z.infer<typeof calendarEventBodySchema>;
