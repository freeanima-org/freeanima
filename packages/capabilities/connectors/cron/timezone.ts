const SIMPLE_HOUR_RE = /^(\S+)\s+(\d+|\*|\*\/\d+|\d+-\d+|\d+(?:,\d+)+)\s+(\S+)\s+(\S+)\s+(\S+)$/;

/** Whether 5-field cron hour is a simple integer needing CST→UTC conversion */
function hasSimpleHourField(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const hour = parts[1];
  return hour !== undefined && /^\d+$/.test(hour);
}

/**
 * CST semantic cron → UTC cron（再经 `scheduleBunCronUtc` / `parseBunCronUtc` 固定 tz=UTC）。
 * Converts only when hour is a simple integer; minute-level steps unchanged.
 */
export function cstCronToUtc(expr: string): string {
  const trimmed = expr.trim();
  if (!hasSimpleHourField(trimmed)) return trimmed;

  const parts = trimmed.split(/\s+/);
  const hourPart = parts[1];
  if (hourPart === undefined) return trimmed;
  const hour = parseInt(hourPart, 10);
  if (Number.isNaN(hour)) return trimmed;

  parts[1] = String((hour - 8 + 24) % 24);
  return parts.join(" ");
}

/** For tests: whether expression will be converted */
export function isSimpleHourCron(expr: string): boolean {
  return SIMPLE_HOUR_RE.test(expr.trim()) && hasSimpleHourField(expr);
}
