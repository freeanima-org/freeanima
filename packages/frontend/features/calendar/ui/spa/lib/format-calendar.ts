import { formatCstIso, hostTimeZoneId } from "@freeanima/shared/util";
import {
  dateLocalToIso,
  isoToDateLocalValue,
  isoToTimeLocalValue,
  mergeDateTimeLocal,
  todayDateLocalValue,
} from "@freeanima/ui-kit/lib/datetime-local.ts";

export {
  dateLocalToIso,
  isoToDateLocalValue,
  isoToTimeLocalValue,
  mergeDateTimeLocal,
  todayDateLocalValue,
};

function hostOffsetSuffix(date: Date = new Date()): string {
  const iso = formatCstIso(date);
  const m = /([+-]\d{2}:\d{2})$/.exec(iso);
  return m?.[1] ?? "+08:00";
}

/** Host-TZ YYYY-MM-DD for a Date instant */
export function cstDayKey(date: Date = new Date()): string {
  return formatCstIso(date).slice(0, 10);
}

/**
 * 将任意 ISO / 日期字符串落到 host 时区日历日（YYYY-MM-DD）。
 * 不可对带时区的 UTC 串直接 slice 前缀（如 `…T16:00:00.000Z` 在 +08 已是次日）。
 * 纯日期 `YYYY-MM-DD` 视为已是日历日，原样返回。
 */
export function dayKeyFromIso(iso: string): string {
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return "";
  return cstDayKey(new Date(ms));
}

/** Host 日键加减天数；非法输入返回 null */
export function shiftDayKey(day: string, delta: number): string | null {
  const parts = day.split("-").map(Number);
  const y = parts[0];
  const mo = parts[1];
  const d = parts[2];
  if (y == null || mo == null || d == null) return null;
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  const next = new Date(Date.UTC(y, mo - 1, d + delta));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

/** Host 日键加一天；非法输入返回 null */
export function nextDayKey(day: string): string | null {
  return shiftDayKey(day, 1);
}

export function dayRangeIso(day: string): { from: string; to: string } {
  const offset = hostOffsetSuffix();
  return {
    from: `${day}T00:00:00${offset}`,
    to: `${day}T23:59:59${offset}`,
  };
}

/** 从 startDay 起连续 dayCount 个自然日的查询窗（含起止日） */
export function nDayRangeIso(startDay: string, dayCount: number): { from: string; to: string } {
  const last = shiftDayKey(startDay, Math.max(dayCount, 1) - 1) ?? startDay;
  const offset = hostOffsetSuffix();
  return {
    from: `${startDay}T00:00:00${offset}`,
    to: `${last}T23:59:59${offset}`,
  };
}

export function listDayKeys(startDay: string, dayCount: number): string[] {
  const days: string[] = [];
  let current: string | null = startDay;
  for (let i = 0; i < dayCount && current; i += 1) {
    days.push(current);
    current = shiftDayKey(current, 1);
  }
  return days;
}

/** 工具栏 / 分组标题：今天带「今天」前缀 */
export function dayHeadingLabel(day: string, today: string): string {
  const parts = day.split("-").map(Number);
  const mo = parts[1];
  const d = parts[2];
  if (mo == null || d == null) return day;
  const date = `${mo}月${d}日`;
  return day === today ? `今天 ${date}` : date;
}

export function monthLabel(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Build month grid cells (Mon-first), each cell is YYYY-MM-DD or null padding */
export function buildMonthGrid(year: number, monthIndex: number): (string | null)[] {
  const cstParts = new Intl.DateTimeFormat("en-US", {
    timeZone: hostTimeZoneId(),
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  }).formatToParts(new Date(Date.UTC(year, monthIndex, 1, 12)));
  const weekdayMap: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const wd = cstParts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const startPad = weekdayMap[wd] ?? 0;

  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const cells: (string | null)[] = [];
  for (let i = 0; i < startPad; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(`${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function monthRangeIso(year: number, monthIndex: number): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const mm = String(monthIndex + 1).padStart(2, "0");
  const offset = hostOffsetSuffix();
  return {
    from: `${year}-${mm}-01T00:00:00${offset}`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59${offset}`,
  };
}

export function shiftMonth(
  year: number,
  monthIndex: number,
  delta: number,
): { year: number; monthIndex: number } {
  const d = new Date(Date.UTC(year, monthIndex + delta, 1));
  return { year: d.getUTCFullYear(), monthIndex: d.getUTCMonth() };
}
