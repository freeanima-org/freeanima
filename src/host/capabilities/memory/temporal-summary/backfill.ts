import type { TemporalSummaryWindow } from "@freeanima/host/core/db/schema";
import { cstDateString, monthPeriodStart, yearPeriodStart } from "./buckets.ts";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function addCstDays(cstDate: string, delta: number): string {
  const parts = cstDate.split("-").map(Number);
  const y = parts[0];
  const m = parts[1];
  const d = parts[2];
  if (y == null || m == null || d == null) return cstDate;
  const dt = new Date(Date.UTC(y, m - 1, d + delta));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

/**
 * Cap backfill [from, to] to CST today (inclusive). Future dates must not be filled.
 * Returns null when the entire range is after today (or inverted after clamp).
 */
export function clampTemporalBackfillRange(opts: {
  from: string;
  to: string;
  /** CST YYYY-MM-DD; defaults to now */
  today?: string;
}): { from: string; to: string; today: string; clamped: boolean } | null {
  const today = opts.today ?? cstDateString();
  const to = opts.to > today ? today : opts.to;
  if (opts.from > to) return null;
  return {
    from: opts.from,
    to,
    today,
    clamped: to !== opts.to,
  };
}

/** Enumerate CST calendar days in [from, to] inclusive. */
export function listCstDaysInRange(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    cur = addCstDays(cur, 1);
  }
  return out;
}

/** Enumerate month period_start (YYYY-MM-01) covering [from, to]. */
export function listMonthPeriodStartsInRange(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let cur = monthPeriodStart(from);
  const end = monthPeriodStart(to);
  while (cur <= end) {
    out.push(cur);
    const y = Number(cur.slice(0, 4));
    const m = Number(cur.slice(5, 7));
    if (m === 12) cur = `${y + 1}-01-01`;
    else cur = `${y}-${pad2(m + 1)}-01`;
  }
  return out;
}

/** Enumerate year period_start (YYYY-01-01) covering [from, to]. */
export function listYearPeriodStartsInRange(from: string, to: string): string[] {
  if (from > to) return [];
  const out: string[] = [];
  let y = Number(yearPeriodStart(from).slice(0, 4));
  const endY = Number(yearPeriodStart(to).slice(0, 4));
  if (!Number.isFinite(y) || !Number.isFinite(endY)) return [];
  while (y <= endY) {
    out.push(`${y}-01-01`);
    y += 1;
  }
  return out;
}

/** Expected period_start values for a window in [from, to]. */
export function listExpectedPeriodStarts(
  window: TemporalSummaryWindow,
  from: string,
  to: string,
): string[] {
  if (window === "day") return listCstDaysInRange(from, to);
  if (window === "month") return listMonthPeriodStartsInRange(from, to);
  return listYearPeriodStartsInRange(from, to);
}

/** Periods that are expected but missing from existing set (never beyond CST today). */
export function listMissingPeriodStarts(opts: {
  window: TemporalSummaryWindow;
  from: string;
  to: string;
  existing: ReadonlySet<string>;
  today?: string;
}): string[] {
  const clamped = clampTemporalBackfillRange({
    from: opts.from,
    to: opts.to,
    ...(opts.today !== undefined ? { today: opts.today } : {}),
  });
  if (!clamped) return [];
  return listExpectedPeriodStarts(opts.window, clamped.from, clamped.to).filter(
    (p) => !opts.existing.has(p),
  );
}
