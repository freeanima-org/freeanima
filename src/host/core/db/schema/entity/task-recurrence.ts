import { z } from "zod";

import {
  gregorianAfterLunarMonths,
  gregorianFromLunar,
  isCnHoliday,
  isCnWeekend,
  isCnWorkday,
  lunarPartsFromGregorian,
} from "@freeanima/host/core/util/cn-calendar";
import { formatCstIso } from "@freeanima/host/core/util";

/** 重复频率 */
export const taskRecurrenceFreqSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);
export type TaskRecurrenceFreq = z.infer<typeof taskRecurrenceFreqSchema>;

/** 推进锚点：按名义排期 / 按实际完成时刻 */
export const taskRecurrenceAnchorSchema = z.enum(["due", "completion"]);
export type TaskRecurrenceAnchor = z.infer<typeof taskRecurrenceAnchorSchema>;

/** 遇非有效日时的跳过策略 */
export const taskRecurrenceSkipSchema = z.enum([
  "none",
  "weekend",
  "holiday",
  "weekend_and_holiday",
]);
export type TaskRecurrenceSkip = z.infer<typeof taskRecurrenceSkipSchema>;

/** 日历类型 */
export const taskRecurrenceCalendarSchema = z.enum(["gregorian", "lunar"]);
export type TaskRecurrenceCalendar = z.infer<typeof taskRecurrenceCalendarSchema>;

const taskRecurrenceLunarRefine = (
  data: {
    calendar?: TaskRecurrenceCalendar | undefined;
    freq: TaskRecurrenceFreq;
    lunar_month?: number | undefined;
    lunar_day?: number | undefined;
  },
  ctx: z.RefinementCtx,
): void => {
  if (data.calendar !== "lunar") return;
  if (data.freq !== "monthly" && data.freq !== "yearly") {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "lunar calendar only supports monthly or yearly",
      path: ["calendar"],
    });
    return;
  }
  if (data.lunar_day == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: `lunar ${data.freq} requires lunar_day`,
      path: ["lunar_day"],
    });
  }
  if (data.freq === "yearly" && data.lunar_month == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "lunar yearly requires lunar_month",
      path: ["lunar_month"],
    });
  }
};

/**
 * Live `task_item.body.recurrence`。
 * `schedule_at` = 规则时钟（仅此一次改期不改）；`due_at` 在 body 顶层为显示/提醒。
 * weekdays：0=Sun … 6=Sat（与 JS `getUTCDay` 在 +08:00 日历下一致时用 CST 部件）。
 */
export const taskRecurrenceSchema = z
  .object({
    freq: taskRecurrenceFreqSchema,
    interval: z.number().int().positive().default(1),
    anchor: taskRecurrenceAnchorSchema.default("due"),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    until: z.string().nullable().optional(),
    /** 剩余可完成次数；每次 complete 递减；耗尽则结束系列 */
    count: z.number().int().positive().nullable().optional(),
    schedule_at: z.string().min(1),
    skip: taskRecurrenceSkipSchema.default("none"),
    /** 仅在工作日推进（跳过周末 + 法定假日，尊重调休上班日） */
    workdays_only: z.boolean().default(false),
    calendar: taskRecurrenceCalendarSchema.default("gregorian"),
    /** 农历月（1-12，闰月为负）；calendar=lunar 且 freq=yearly 时必填 */
    lunar_month: z.number().int().min(-12).max(12).optional(),
    /** 农历日（1-30）；calendar=lunar 且 freq=monthly|yearly 时必填 */
    lunar_day: z.number().int().min(1).max(30).optional(),
  })
  .superRefine(taskRecurrenceLunarRefine);

export type TaskRecurrence = z.infer<typeof taskRecurrenceSchema>;

/** 创建 recurrence 时的输入（schedule_at 可省略，由 due_at 填充） */
export const taskRecurrenceInputSchema = z
  .object({
    freq: taskRecurrenceFreqSchema,
    interval: z.number().int().positive().optional(),
    anchor: taskRecurrenceAnchorSchema.optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
    until: z.string().nullable().optional(),
    count: z.number().int().positive().nullable().optional(),
    schedule_at: z.string().min(1).optional(),
    skip: taskRecurrenceSkipSchema.optional(),
    workdays_only: z.boolean().optional(),
    calendar: taskRecurrenceCalendarSchema.optional(),
    lunar_month: z.number().int().min(-12).max(12).optional(),
    lunar_day: z.number().int().min(1).max(30).optional(),
  })
  .superRefine(taskRecurrenceLunarRefine);

export type TaskRecurrenceInput = z.infer<typeof taskRecurrenceInputSchema>;

function cstParts(date: Date): {
  y: number;
  mo: number;
  d: number;
  h: number;
  mi: number;
  s: number;
  weekday: number;
} {
  const iso = formatCstIso(date);
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})/.exec(iso);
  if (!m) {
    throw new Error(`invalid CST iso: ${iso}`);
  }
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  const s = Number(m[6]);
  const weekday = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return { y, mo, d, h, mi, s, weekday };
}

function fromCstParts(y: number, mo: number, d: number, h: number, mi: number, s: number): Date {
  return new Date(
    `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}T${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}:${String(s).padStart(2, "0")}+08:00`,
  );
}

function daysInMonth(y: number, mo: number): number {
  return new Date(Date.UTC(y, mo, 0)).getUTCDate();
}

function addCalendarMonths(
  parts: ReturnType<typeof cstParts>,
  months: number,
): ReturnType<typeof cstParts> {
  const total = parts.y * 12 + (parts.mo - 1) + months;
  const y = Math.floor(total / 12);
  const mo = (total % 12) + 1;
  const d = Math.min(parts.d, daysInMonth(y, mo));
  return { ...parts, y, mo, d, weekday: new Date(Date.UTC(y, mo - 1, d)).getUTCDay() };
}

function addCalendarDays(
  parts: ReturnType<typeof cstParts>,
  days: number,
): ReturnType<typeof cstParts> {
  const base = fromCstParts(parts.y, parts.mo, parts.d, 12, 0, 0);
  const next = new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
  const n = cstParts(next);
  return { ...n, h: parts.h, mi: parts.mi, s: parts.s };
}

type ScheduleDayPolicy = Pick<TaskRecurrence, "skip" | "workdays_only">;

function isScheduleDayValid(date: Date, policy: ScheduleDayPolicy): boolean {
  if (policy.workdays_only) {
    return isCnWorkday(date);
  }
  const skip = policy.skip ?? "none";
  if (skip === "none") return true;
  const weekend = isCnWeekend(date);
  const holiday = isCnHoliday(date);
  if (skip === "weekend") return !weekend;
  if (skip === "holiday") return !holiday;
  if (skip === "weekend_and_holiday") return !weekend && !holiday;
  return true;
}

/** 逐日推进直到满足 skip / workdays_only 策略 */
function adjustForSchedulePolicy(
  parts: ReturnType<typeof cstParts>,
  policy: ScheduleDayPolicy,
): ReturnType<typeof cstParts> {
  if (!policy.workdays_only && (policy.skip ?? "none") === "none") {
    return parts;
  }
  let current = parts;
  for (let i = 0; i < 366; i++) {
    const date = fromCstParts(current.y, current.mo, current.d, current.h, current.mi, current.s);
    if (isScheduleDayValid(date, policy)) {
      return current;
    }
    current = addCalendarDays(current, 1);
  }
  throw new Error("schedule policy: no valid day within 366 days");
}

/** 从锚点时刻推进一期（不含 until/count 终止判断） */
export function advanceScheduleAt(
  scheduleAtIso: string,
  recurrence: Pick<
    TaskRecurrence,
    | "freq"
    | "interval"
    | "weekdays"
    | "skip"
    | "workdays_only"
    | "calendar"
    | "lunar_month"
    | "lunar_day"
  >,
): string {
  const start = new Date(scheduleAtIso);
  if (Number.isNaN(start.getTime())) {
    throw new Error(`invalid schedule_at: ${scheduleAtIso}`);
  }
  const interval = Math.max(1, recurrence.interval);
  let parts = cstParts(start);

  if (recurrence.freq === "daily") {
    parts = addCalendarDays(parts, interval);
  } else if (recurrence.freq === "weekly") {
    if (!recurrence.weekdays?.length) {
      parts = addCalendarDays(parts, interval * 7);
    } else {
      const weekdays = [...new Set(recurrence.weekdays)].toSorted((a, b) => a - b);
      let found: ReturnType<typeof cstParts> | null = null;
      let foundOffset = 0;
      for (let offset = 1; offset <= 7; offset++) {
        const cand = addCalendarDays(parts, offset);
        if (weekdays.includes(cand.weekday)) {
          found = cand;
          foundOffset = offset;
          break;
        }
      }
      if (!found) {
        throw new Error("weekly recurrence: no weekday target");
      }
      // 跨入下一周且 interval>1：再跳 (interval-1) 整周（同周内多个 weekdays 不跳）
      if (interval > 1 && (foundOffset === 7 || found.weekday <= parts.weekday)) {
        found = addCalendarDays(found, (interval - 1) * 7);
      }
      parts = found;
    }
  } else if (recurrence.freq === "monthly") {
    if (recurrence.calendar === "lunar") {
      const lunarDay = recurrence.lunar_day;
      if (lunarDay == null) {
        throw new Error("lunar monthly requires lunar_day");
      }
      const nextGreg = gregorianAfterLunarMonths(start, lunarDay, interval);
      const n = cstParts(nextGreg);
      parts = { ...n, h: parts.h, mi: parts.mi, s: parts.s };
    } else {
      parts = addCalendarMonths(parts, interval);
    }
  } else if (recurrence.freq === "yearly") {
    if (recurrence.calendar === "lunar") {
      const lunarMonth = recurrence.lunar_month;
      const lunarDay = recurrence.lunar_day;
      if (lunarMonth == null || lunarDay == null) {
        throw new Error("lunar yearly requires lunar_month and lunar_day");
      }
      const currentLunar = lunarPartsFromGregorian(start);
      const nextGreg = gregorianFromLunar(currentLunar.year + interval, lunarMonth, lunarDay);
      const n = cstParts(nextGreg);
      parts = { ...n, h: parts.h, mi: parts.mi, s: parts.s };
    } else {
      parts = addCalendarMonths(parts, interval * 12);
    }
  } else {
    const unsupportedFreq = recurrence.freq satisfies never;
    throw new Error(`unsupported recurrence freq: ${String(unsupportedFreq)}`);
  }

  parts = adjustForSchedulePolicy(parts, recurrence);

  return formatCstIso(fromCstParts(parts.y, parts.mo, parts.d, parts.h, parts.mi, parts.s));
}

export type NextOccurrence = {
  due_at: string;
  schedule_at: string;
  recurrence: TaskRecurrence;
};

/**
 * 计算下一期。若系列应结束（count 耗尽 / 超过 until）返回 null。
 * `completedAt`：completion 锚用；due 锚忽略。
 * `decrementCount`：complete 为 true；skip 为 false。
 */
export function computeNextOccurrence(
  recurrence: TaskRecurrence,
  opts: {
    completedAt: string;
    currentDueAt?: string | null;
    decrementCount?: boolean;
  },
): NextOccurrence | null {
  let nextRec: TaskRecurrence = { ...recurrence };
  if (opts.decrementCount !== false && nextRec.count != null) {
    const remaining = nextRec.count - 1;
    if (remaining <= 0) return null;
    nextRec = { ...nextRec, count: remaining };
  }

  const anchorIso = nextRec.anchor === "completion" ? opts.completedAt : nextRec.schedule_at;
  const nextSchedule = advanceScheduleAt(anchorIso, nextRec);

  if (nextRec.until) {
    const untilMs = new Date(nextRec.until).getTime();
    const nextMs = new Date(nextSchedule).getTime();
    if (!Number.isNaN(untilMs) && !Number.isNaN(nextMs) && nextMs > untilMs) {
      return null;
    }
  }

  nextRec = { ...nextRec, schedule_at: nextSchedule };
  return {
    due_at: nextSchedule,
    schedule_at: nextSchedule,
    recurrence: nextRec,
  };
}

/** 保持 remind 相对 due 的偏移；任一方缺失则 remind=null */
export function shiftRemindAt(
  prevDueAt: string | null | undefined,
  prevRemindAt: string | null | undefined,
  nextDueAt: string,
): string | null {
  if (!prevDueAt || !prevRemindAt) return null;
  const dueMs = new Date(prevDueAt).getTime();
  const remindMs = new Date(prevRemindAt).getTime();
  if (Number.isNaN(dueMs) || Number.isNaN(remindMs)) return null;
  return formatCstIso(new Date(new Date(nextDueAt).getTime() + (remindMs - dueMs)));
}

/** 将创建输入规范为存库 recurrence（补 schedule_at） */
export function normalizeRecurrenceInput(
  input: TaskRecurrenceInput,
  dueAt: string | null | undefined,
): TaskRecurrence {
  const schedule_at = input.schedule_at ?? dueAt;
  if (!schedule_at) {
    throw new Error("recurrence requires schedule_at or due_at");
  }
  return taskRecurrenceSchema.parse({
    ...input,
    schedule_at,
  });
}
