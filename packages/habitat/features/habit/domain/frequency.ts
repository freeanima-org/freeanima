import type { HabitFrequency } from "@freeanima/habitat/core/db/schema/entity";
import {
  formatOffsetIso,
  getConfiguredHostTimeZone,
  hostCalendarDay,
  timeZoneOffsetMs,
} from "@freeanima/shared/util/time.ts";

const DAY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDayParts(day: string): { y: number; m: number; d: number } | null {
  const m = DAY_RE.exec(day.trim());
  if (!m) return null;
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

/** 宿主时区自然日的 weekday（0=Sun … 6=Sat） */
export function weekdayOfHostDay(day: string): number | null {
  const parts = parseDayParts(day);
  if (!parts) return null;
  const tz = getConfiguredHostTimeZone();
  const offset = formatOffsetIso(timeZoneOffsetMs(tz, new Date(`${day}T12:00:00Z`)));
  const noon = new Date(`${day}T12:00:00${offset}`);
  const name = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(noon);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[name] ?? null;
}

function daysBetween(a: string, b: string): number | null {
  const pa = parseDayParts(a);
  const pb = parseDayParts(b);
  if (!pa || !pb) return null;
  const da = Date.UTC(pa.y, pa.m - 1, pa.d);
  const db = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((db - da) / 86_400_000);
}

export function addHostDays(day: string, delta: number): string | null {
  const parts = parseDayParts(day);
  if (!parts) return null;
  const utc = new Date(Date.UTC(parts.y, parts.m - 1, parts.d + delta));
  const y = utc.getUTCFullYear();
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0");
  const d = String(utc.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 该自然日是否应按频率打卡 */
export function isHabitDueOnDay(
  frequency: HabitFrequency,
  day: string,
  createdDay?: string,
): boolean {
  const wd = weekdayOfHostDay(day);
  if (wd == null) return false;

  if (frequency.freq === "weekly") {
    const days = frequency.weekdays ?? [];
    if (!days.includes(wd)) return false;
    const interval = frequency.interval || 1;
    if (interval <= 1) return true;
    const anchor = frequency.anchor_day ?? createdDay ?? day;
    const diff = daysBetween(anchor, day);
    if (diff == null || diff < 0) return false;
    // 按周序号间隔
    const weeks = Math.floor(diff / 7);
    return weeks % interval === 0;
  }

  // daily
  const interval = frequency.interval || 1;
  if (interval <= 1) return true;
  const anchor = frequency.anchor_day ?? createdDay ?? day;
  const diff = daysBetween(anchor, day);
  if (diff == null || diff < 0) return false;
  return diff % interval === 0;
}

export function todayHostDay(): string {
  return hostCalendarDay();
}

export function listDaysInMonth(month: string): string[] {
  const m = /^(\d{4})-(\d{2})$/.exec(month.trim());
  if (!m) return [];
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const out: string[] = [];
  for (let d = 1; d <= 31; d += 1) {
    const utc = new Date(Date.UTC(y, mo - 1, d));
    if (utc.getUTCFullYear() !== y || utc.getUTCMonth() + 1 !== mo) break;
    out.push(`${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  }
  return out;
}

export function eachDayInclusive(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cur: string | null = from;
  while (cur && cur <= to) {
    out.push(cur);
    cur = addHostDays(cur, 1);
  }
  return out;
}
