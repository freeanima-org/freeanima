import { z } from "zod";

import { formatCstIso } from "@freeanima/host/core/util";

/** 重复频率 */
export const taskRecurrenceFreqSchema = z.enum(["daily", "weekly", "monthly", "yearly"]);
export type TaskRecurrenceFreq = z.infer<typeof taskRecurrenceFreqSchema>;

/** 推进锚点：按名义排期 / 按实际完成时刻 */
export const taskRecurrenceAnchorSchema = z.enum(["due", "completion"]);
export type TaskRecurrenceAnchor = z.infer<typeof taskRecurrenceAnchorSchema>;

/**
 * Live `task_item.body.recurrence`。
 * `schedule_at` = 规则时钟（仅此一次改期不改）；`due_at` 在 body 顶层为显示/提醒。
 * weekdays：0=Sun … 6=Sat（与 JS `getUTCDay` 在 +08:00 日历下一致时用 CST 部件）。
 */
export const taskRecurrenceSchema = z.object({
  freq: taskRecurrenceFreqSchema,
  interval: z.number().int().positive().default(1),
  anchor: taskRecurrenceAnchorSchema.default("due"),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  until: z.string().nullable().optional(),
  /** 剩余可完成次数；每次 complete 递减；耗尽则结束系列 */
  count: z.number().int().positive().nullable().optional(),
  schedule_at: z.string().min(1),
});

export type TaskRecurrence = z.infer<typeof taskRecurrenceSchema>;

/** 创建 recurrence 时的输入（schedule_at 可省略，由 due_at 填充） */
export const taskRecurrenceInputSchema = z.object({
  freq: taskRecurrenceFreqSchema,
  interval: z.number().int().positive().optional(),
  anchor: taskRecurrenceAnchorSchema.optional(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1).optional(),
  until: z.string().nullable().optional(),
  count: z.number().int().positive().nullable().optional(),
  schedule_at: z.string().min(1).optional(),
});

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

/** 从锚点时刻推进一期（不含 until/count 终止判断） */
export function advanceScheduleAt(
  scheduleAtIso: string,
  recurrence: Pick<TaskRecurrence, "freq" | "interval" | "weekdays">,
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
    parts = addCalendarMonths(parts, interval);
  } else {
    parts = addCalendarMonths(parts, interval * 12);
  }

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
