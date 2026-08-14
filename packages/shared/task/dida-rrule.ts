/**
 * 滴答清单 CSV `Repeat` 字段 → FreeAnima TaskRecurrenceInput。
 * 支持样例常见子集；ERULE/CUSTOM 等返回 null + reason。
 */

import type { TaskRecurrenceInput } from "@freeanima/shared/pg-shapes/entity/task-recurrence.ts";
import type {
  TaskRecurrenceCalendar,
  TaskRecurrenceFreq,
  TaskRecurrenceSkip,
} from "@freeanima/shared/pg-shapes/entity/task-recurrence.ts";

export type ParseDidaRepeatResult =
  | { ok: true; recurrence: TaskRecurrenceInput }
  | { ok: false; reason: string };

const BYDAY_MAP: Record<string, number> = {
  SU: 0,
  MO: 1,
  TU: 2,
  WE: 3,
  TH: 4,
  FR: 5,
  SA: 6,
};

function parseParts(raw: string): Map<string, string> {
  const map = new Map<string, string>();
  for (const seg of raw.split(";")) {
    const trimmed = seg.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    map.set(trimmed.slice(0, eq).toUpperCase(), trimmed.slice(eq + 1));
  }
  return map;
}

function parseUntil(raw: string | undefined): string | null {
  if (!raw) return null;
  // UNTIL=20460601 or ISO
  if (/^\d{8}$/.test(raw)) {
    const y = raw.slice(0, 4);
    const mo = raw.slice(4, 6);
    const d = raw.slice(6, 8);
    return `${y}-${mo}-${d}T23:59:59+08:00`;
  }
  const ms = Date.parse(raw);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms).toISOString();
}

function mapSkip(ttSkip: string | undefined): TaskRecurrenceSkip {
  if (!ttSkip) return "none";
  const u = ttSkip.toUpperCase();
  if (u === "WEEKEND") return "weekend";
  if (u === "HOLIDAY") return "holiday";
  if (u === "WEEKEND_AND_HOLIDAY" || u === "WEEKENDANDHOLIDAY") return "weekend_and_holiday";
  return "none";
}

/**
 * @param repeatRaw CSV Repeat 列
 * @param dueAt 当前 due（用作 schedule_at 初值；BYMONTH/BYDAY 时仍以 due 时刻的时分秒为准）
 */
export function parseDidaRepeat(
  repeatRaw: string | null | undefined,
  dueAt: string,
): ParseDidaRepeatResult {
  const raw = (repeatRaw ?? "").trim();
  if (!raw) {
    return { ok: false, reason: "empty repeat" };
  }
  if (/^ERULE:/i.test(raw) || /BYDATE=/i.test(raw) || /NAME=CUSTOM/i.test(raw)) {
    return { ok: false, reason: `unsupported custom rule: ${raw}` };
  }

  let calendar: TaskRecurrenceCalendar = "gregorian";
  let body = raw;
  if (/^LUNAR:/i.test(body)) {
    calendar = "lunar";
    body = body.slice("LUNAR:".length);
  }

  const parts = parseParts(body);
  const freqRaw = (parts.get("FREQ") ?? "").toUpperCase();
  const freqMap: Record<string, TaskRecurrenceFreq> = {
    DAILY: "daily",
    WEEKLY: "weekly",
    MONTHLY: "monthly",
    YEARLY: "yearly",
  };
  const freq = freqMap[freqRaw];
  if (!freq) {
    return { ok: false, reason: `unsupported FREQ: ${freqRaw || "(missing)"}` };
  }

  const interval = Math.max(1, Number.parseInt(parts.get("INTERVAL") ?? "1", 10) || 1);
  const countRaw = parts.get("COUNT");
  const count =
    countRaw != null && countRaw !== "" ? Math.max(1, Number.parseInt(countRaw, 10) || 1) : null;
  const until = parseUntil(parts.get("UNTIL"));
  const skip = mapSkip(parts.get("TT_SKIP"));

  const weekdaysRaw = parts.get("BYDAY");
  let weekdays: number[] | undefined;
  if (weekdaysRaw) {
    const days: number[] = [];
    for (const token of weekdaysRaw.split(",")) {
      const t = token
        .trim()
        .toUpperCase()
        .replace(/^-?\d+/, "");
      const d = BYDAY_MAP[t];
      if (d != null) days.push(d);
    }
    if (days.length > 0) weekdays = [...new Set(days)].toSorted((a, b) => a - b);
  }

  const byMonth = parts.get("BYMONTH");
  const byMonthDay = parts.get("BYMONTHDAY");
  let lunar_month: number | undefined;
  let lunar_day: number | undefined;
  if (calendar === "lunar") {
    if (byMonth != null && byMonth !== "") {
      lunar_month = Number.parseInt(byMonth, 10);
    }
    if (byMonthDay != null && byMonthDay !== "") {
      lunar_day = Number.parseInt(byMonthDay, 10);
    }
    if (freq === "yearly" && (lunar_month == null || lunar_day == null)) {
      return { ok: false, reason: "lunar yearly requires BYMONTH and BYMONTHDAY" };
    }
    if (freq === "monthly" && lunar_day == null) {
      return { ok: false, reason: "lunar monthly requires BYMONTHDAY" };
    }
  }

  // 公历：用 dueAt 作 schedule_at；若带 BYMONTH/BYMONTHDAY 且 due 日部件不一致，仍信任 due（导入时 due 已是下一期）
  const recurrence: TaskRecurrenceInput = {
    freq,
    interval,
    anchor: "due",
    schedule_at: dueAt,
    skip,
    calendar,
    ...(weekdays?.length ? { weekdays } : {}),
    ...(until ? { until } : {}),
    ...(count != null ? { count } : {}),
    ...(lunar_month != null ? { lunar_month } : {}),
    ...(lunar_day != null ? { lunar_day } : {}),
  };

  // 无 weekdays 的 weekly：按 due 的星期推进即可（advance 无 weekdays 时 +7*interval）
  void byMonth;
  void byMonthDay;

  return { ok: true, recurrence };
}
