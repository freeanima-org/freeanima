import { CST_OFFSET_MS, formatCstIso } from "@freeanima/host/core/util/time";
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

/** CST YYYY-MM-DD for a Date instant */
export function cstDayKey(date: Date = new Date()): string {
  return formatCstIso(date).slice(0, 10);
}

/**
 * 将任意 ISO / 日期字符串落到 CST 日历日（YYYY-MM-DD）。
 * 不可对带时区的 UTC 串直接 slice 前缀（如 `…T16:00:00.000Z` 在 CST 已是次日）。
 * 纯日期 `YYYY-MM-DD` 视为已是日历日，原样返回。
 */
export function dayKeyFromIso(iso: string): string {
  const trimmed = iso.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const ms = Date.parse(trimmed);
  if (!Number.isFinite(ms)) return "";
  return cstDayKey(new Date(ms));
}

export function monthLabel(year: number, monthIndex: number): string {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}

/** Build month grid cells (Mon-first), each cell is YYYY-MM-DD or null padding */
export function buildMonthGrid(year: number, monthIndex: number): (string | null)[] {
  const firstUtc = Date.UTC(year, monthIndex, 1) - CST_OFFSET_MS;
  const first = new Date(firstUtc + CST_OFFSET_MS);
  // weekday in CST: 0=Sun..6=Sat → Mon-first offset
  const cstParts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Shanghai",
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
  void first;
  return cells;
}

export function monthRangeIso(year: number, monthIndex: number): { from: string; to: string } {
  const lastDay = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  const mm = String(monthIndex + 1).padStart(2, "0");
  return {
    from: `${year}-${mm}-01T00:00:00+08:00`,
    to: `${year}-${mm}-${String(lastDay).padStart(2, "0")}T23:59:59+08:00`,
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
