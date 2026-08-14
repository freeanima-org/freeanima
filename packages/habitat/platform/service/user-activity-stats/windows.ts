import { CST_OFFSET_MS } from "@freeanima/habitat/core/util";
import type {
  ActivityWindowBound,
  ActivityWindowId,
} from "@freeanima/habitat/core/db/pg/conversation";

export type ActivityWindowDef = ActivityWindowBound & {
  label: string;
};

const LABELS: Record<ActivityWindowId, string> = {
  today: "今天",
  yesterday: "昨天",
  day_before_yesterday: "前天",
  last_7d: "近 7 天",
  last_30d: "近 30 天",
  last_90d: "近 90 天",
  last_365d: "近 1 年",
};

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** CST 日历日 YYYY-MM-DD（相对 nowMs） */
export function cstCalendarDayString(nowMs: number = Date.now()): string {
  const cst = new Date(nowMs + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${pad2(cst.getUTCMonth() + 1)}-${pad2(cst.getUTCDate())}`;
}

function parseDay(day: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  if (!m) throw new Error(`invalid CST day: ${day}`);
  return { y: Number(m[1]), m: Number(m[2]) - 1, d: Number(m[3]) };
}

function formatDay(y: number, m: number, d: number): string {
  const dt = new Date(Date.UTC(y, m, d));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/** 相对 dayStr 偏移日历日 */
export function shiftCstDay(dayStr: string, deltaDays: number): string {
  const { y, m, d } = parseDay(dayStr);
  return formatDay(y, m, d + deltaDays);
}

/** 单日 [00:00, 次日 00:00) CST */
export function cstDayBounds(dayStr: string): { from_iso: string; to_iso: string } {
  const next = shiftCstDay(dayStr, 1);
  return {
    from_iso: `${dayStr}T00:00:00+08:00`,
    to_iso: `${next}T00:00:00+08:00`,
  };
}

/** 含今天共 n 个日历日 → [today-(n-1), tomorrow) */
export function cstRollingBounds(
  todayStr: string,
  dayCount: number,
): { from_iso: string; to_iso: string } {
  const fromDay = shiftCstDay(todayStr, -(dayCount - 1));
  const tomorrow = shiftCstDay(todayStr, 1);
  return {
    from_iso: `${fromDay}T00:00:00+08:00`,
    to_iso: `${tomorrow}T00:00:00+08:00`,
  };
}

/**
 * 距下一 CST 午夜的秒数（至少 60s），供 cache TTL。
 */
export function secondsUntilNextCstMidnight(nowMs: number = Date.now()): number {
  const today = cstCalendarDayString(nowMs);
  const tomorrow = shiftCstDay(today, 1);
  const nextMs = Date.parse(`${tomorrow}T00:00:00+08:00`);
  const sec = Math.ceil((nextMs - nowMs) / 1000);
  return Math.max(60, sec + 3600);
}

export function buildUserActivityWindows(nowMs: number = Date.now()): {
  as_of_day: string;
  windows: ActivityWindowDef[];
} {
  const today = cstCalendarDayString(nowMs);
  const yesterday = shiftCstDay(today, -1);
  const dayBefore = shiftCstDay(today, -2);

  const single = (id: ActivityWindowId, day: string): ActivityWindowDef => {
    const b = cstDayBounds(day);
    return { id, label: LABELS[id], from_iso: b.from_iso, to_iso: b.to_iso };
  };

  const rolling = (id: ActivityWindowId, n: number): ActivityWindowDef => {
    const b = cstRollingBounds(today, n);
    return { id, label: LABELS[id], from_iso: b.from_iso, to_iso: b.to_iso };
  };

  return {
    as_of_day: today,
    windows: [
      single("today", today),
      single("yesterday", yesterday),
      single("day_before_yesterday", dayBefore),
      rolling("last_7d", 7),
      rolling("last_30d", 30),
      rolling("last_90d", 90),
      rolling("last_365d", 365),
    ],
  };
}
