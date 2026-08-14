import type { TaskItemSearchFilters } from "./api.ts";

/** Asia/Shanghai 日历日 YYYY-MM-DD */
export function cstCalendarDay(date: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** CST 日历日 00:00 → ISO（UTC） */
export function cstDayStartIso(day: string): string {
  return new Date(`${day}T00:00:00+08:00`).toISOString();
}

function shiftCstDay(day: string, deltaDays: number): string {
  const base = new Date(`${day}T12:00:00+08:00`);
  base.setUTCDate(base.getUTCDate() + deltaDays);
  return cstCalendarDay(base);
}

function relativeDueDay(relative: "today" | "tomorrow" | "yesterday", today: string): string {
  if (relative === "today") return today;
  if (relative === "tomorrow") return shiftCstDay(today, 1);
  return shiftCstDay(today, -1);
}

function dayFromIsoOrDate(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return cstCalendarDay(d);
}

function clampDayToRange(today: string, start: string | null, end: string | null): string | null {
  if (start == null && end == null) return null;
  if (start != null && end != null) {
    if (today < start) return start;
    if (today > end) return end;
    return today;
  }
  if (start != null) return today < start ? start : today;
  if (end != null) return today > end ? end : today;
  return null;
}

/**
 * 从智能清单 filters 推导快速添加应写入的 due_at。
 * 时间点 → 该日；日期段 → 段内距今最近的合法 CST 日（通常为今天）。
 */
export function resolveSmartListDueAt(
  filters: TaskItemSearchFilters,
  now: Date = new Date(),
): string | null {
  const today = cstCalendarDay(now);

  if (filters.due_on != null) {
    return cstDayStartIso(relativeDueDay(filters.due_on, today));
  }

  if (filters.due_today === true) {
    return cstDayStartIso(today);
  }

  if (filters.due_on_or_before_days != null) {
    // 段 (-∞, today+N]：距今最近合法日 = today（today 恒 ≤ today+N）
    return cstDayStartIso(today);
  }

  const afterDay = filters.due_after ? dayFromIsoOrDate(filters.due_after) : null;
  const beforeDay = filters.due_before ? dayFromIsoOrDate(filters.due_before) : null;
  if (afterDay != null || beforeDay != null) {
    const day = clampDayToRange(today, afterDay, beforeDay);
    return day ? cstDayStartIso(day) : null;
  }

  return null;
}
