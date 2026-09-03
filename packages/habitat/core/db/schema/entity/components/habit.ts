import { HABIT_COMPONENT } from "@freeanima/shared/pg-shapes/entity/component-ids.ts";
export { HABIT_COMPONENT };

import { z } from "zod";

/** 养成 / 戒除 */
export const habitPolaritySchema = z.enum(["build", "break"]);
export type HabitPolarity = z.infer<typeof habitPolaritySchema>;

/** 完成全部 / 自动定量 / 手动定量 */
export const habitRecordModeSchema = z.enum(["boolean", "auto", "manual"]);
export type HabitRecordMode = z.infer<typeof habitRecordModeSchema>;

export const habitDaySectionSchema = z.enum(["morning", "afternoon", "evening", "other"]);
export type HabitDaySection = z.infer<typeof habitDaySectionSchema>;

export const habitStatusSchema = z.enum(["active", "archived"]);
export type HabitStatus = z.infer<typeof habitStatusSchema>;

export const habitCheckInStyleSchema = z.enum(["check", "stamp"]);
export type HabitCheckInStyle = z.infer<typeof habitCheckInStyleSchema>;

/** HH:mm 当日提醒点 */
export const habitReminderSchema = z.object({
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  /** 已通知的宿主时区自然日；防同日重发 */
  last_notified_day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});
export type HabitReminder = z.infer<typeof habitReminderSchema>;

/**
 * 习惯频率：task recurrence 子集（仅 daily/weekly；无农历）。
 * weekdays：0=Sun … 6=Sat。
 */
export const habitFrequencySchema = z.object({
  freq: z.enum(["daily", "weekly"]),
  interval: z.number().int().positive().default(1),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  /** 间隔起算锚日 YYYY-MM-DD；缺省用创建日 */
  anchor_day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
});
export type HabitFrequency = z.infer<typeof habitFrequencySchema>;

export const habitBodySchema = z
  .object({
    polarity: habitPolaritySchema.default("build"),
    record_mode: habitRecordModeSchema.default("boolean"),
    /** 养成=日目标；戒除=日上限。boolean+养成=1；boolean+戒除=0 */
    target: z.number().nonnegative().default(1),
    unit: z.string().nullable().default(null),
    auto_amount: z.number().positive().nullable().default(null),
    frequency: habitFrequencySchema.default({ freq: "daily", interval: 1 }),
    day_section: habitDaySectionSchema.default("other"),
    reminders: z.array(habitReminderSchema).default([]),
    enable_journal: z.boolean().default(true),
    check_in_style: habitCheckInStyleSchema.default("check"),
    status: habitStatusSchema.default("active"),
    sort_order: z.number().int().default(0),
    color: z.string().nullable().optional(),
    icon: z.string().nullable().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.record_mode === "boolean") {
      const expected = data.polarity === "break" ? 0 : 1;
      if (data.target !== expected) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            data.polarity === "break" ? "boolean 戒除 target 须为 0" : "boolean 养成 target 须为 1",
          path: ["target"],
        });
      }
    }
    if (data.record_mode === "auto" && (data.auto_amount == null || data.auto_amount <= 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "auto 打卡须设置 auto_amount",
        path: ["auto_amount"],
      });
    }
    if (
      data.frequency.freq === "weekly" &&
      (!data.frequency.weekdays || data.frequency.weekdays.length === 0)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "weekly 须设置 weekdays",
        path: ["frequency", "weekdays"],
      });
    }
  });

export type HabitBody = z.infer<typeof habitBodySchema>;
