import { HABIT_CHECK_IN_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { HABIT_CHECK_IN_COMPONENT };

import { z } from "zod";

export const habitMoodSchema = z.enum(["great", "good", "ok", "bad"]);
export type HabitMood = z.infer<typeof habitMoodSchema>;

export const habitCheckInBodySchema = z.object({
  habit_id: z.number().int().positive(),
  /** 宿主时区自然日 YYYY-MM-DD */
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.number().nonnegative().default(0),
  mood: habitMoodSchema.nullable().default(null),
  note: z.string().nullable().default(null),
  checked_at: z.string().min(1),
});

export type HabitCheckInBody = z.infer<typeof habitCheckInBodySchema>;
