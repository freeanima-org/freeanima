import {
  getEarliestConversationDay,
  getEarliestMessageDay,
  listConversationActivityDays,
} from "@freeanima/habitat/core/db/pg/conversation";
import { listCompletedStepDays } from "@freeanima/habitat/core/db/pg/pipeline";
import { listTemporalSummariesInRange } from "@freeanima/habitat/core/db/pg/temporal-summary";
import { CST_OFFSET_MS } from "@freeanima/habitat/core/util";

import type { SleepCatchUpPlan } from "./sleep-catch-up-types.ts";

export type { SleepCatchUpPlan } from "./sleep-catch-up-types.ts";

/** Align with memory-maintenance pipeline ids (avoid importing platform from capabilities). */
const MEMORY_MAINTENANCE_PIPELINE_ID = "memory-maintenance";
const LEGACY_SLEEP_CYCLE_PIPELINE_ID = "sleep-cycle";
const RETAIN_CATCH_UP_STEP_ID = "retain-catch-up";
const LEGACY_LIGHT_SLEEP_STEP_ID = "light-sleep";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today as CST YYYY-MM-DD */
export function todayCstDay(nowMs: number = Date.now()): string {
  const cst = new Date(nowMs + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${pad2(cst.getUTCMonth() + 1)}-${pad2(cst.getUTCDate())}`;
}

/**
 * Month-start CST dates (YYYY-MM-01) in [fromDay, toDay] inclusive.
 * Cascade runs on these days to rebuild the *previous* month (and year on Jan 1).
 */
export function listMonthStartsInRange(fromDay: string, toDay: string): string[] {
  if (fromDay > toDay) return [];
  const out: string[] = [];
  let y = Number(fromDay.slice(0, 4));
  let m = Number(fromDay.slice(5, 7));
  const endY = Number(toDay.slice(0, 4));
  const endM = Number(toDay.slice(5, 7));
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(endY) ||
    !Number.isFinite(endM)
  ) {
    return [];
  }
  // Start from the first month whose -01 falls in range (or next month if fromDay mid-month)
  const fromDayNum = Number(fromDay.slice(8, 10));
  if (fromDayNum > 1) {
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  while (y < endY || (y === endY && m <= endM)) {
    const monthStart = `${y}-${pad2(m)}-01`;
    if (monthStart >= fromDay && monthStart <= toDay) {
      out.push(monthStart);
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** @deprecated Use listMonthStartsInRange — cascade triggers on month starts. */
export function listMonthEndsInRange(fromDay: string, toDay: string): string[] {
  if (fromDay > toDay) return [];
  const out: string[] = [];
  let y = Number(fromDay.slice(0, 4));
  let m = Number(fromDay.slice(5, 7));
  const endY = Number(toDay.slice(0, 4));
  const endM = Number(toDay.slice(5, 7));
  if (
    !Number.isFinite(y) ||
    !Number.isFinite(m) ||
    !Number.isFinite(endY) ||
    !Number.isFinite(endM)
  ) {
    return [];
  }
  while (y < endY || (y === endY && m <= endM)) {
    const last = new Date(Date.UTC(y, m, 0));
    const monthEnd = `${y}-${pad2(m)}-${pad2(last.getUTCDate())}`;
    if (monthEnd >= fromDay && monthEnd <= toDay) {
      out.push(monthEnd);
    }
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out;
}

/** Pure gap computation (unit-testable without DB). */
export function computeSleepCatchUpDays(input: {
  activityDays: readonly string[];
  completedLightDays: ReadonlySet<string>;
  existingTemporalDays: ReadonlySet<string>;
  from: string;
  to: string;
}): Pick<SleepCatchUpPlan, "light_days" | "temporal_days" | "cascade_days" | "days"> {
  const light_days = input.activityDays
    .filter((d) => d >= input.from && d <= input.to && !input.completedLightDays.has(d))
    .toSorted();
  const temporal_days = input.activityDays
    .filter((d) => d >= input.from && d <= input.to && !input.existingTemporalDays.has(d))
    .toSorted();
  const daySet = new Set([...light_days, ...temporal_days]);
  const days = [...daySet].toSorted();
  // Cascade on month starts in range (rebuilds previous month / year); no-op if empty material
  const cascade_days =
    light_days.length > 0 || temporal_days.length > 0
      ? listMonthStartsInRange(input.from, input.to)
      : [];
  return { light_days, temporal_days, cascade_days, days };
}

export async function planSleepCatchUp(opts?: {
  nowMs?: number;
}): Promise<{ ok: true; plan: SleepCatchUpPlan } | { ok: false; reason: string }> {
  const end = todayCstDay(opts?.nowMs);
  const start = (await getEarliestConversationDay()) ?? (await getEarliestMessageDay()) ?? null;
  if (!start) {
    return { ok: false, reason: "no_conversations_or_messages" };
  }
  if (start > end) {
    return { ok: false, reason: "start_after_end" };
  }

  const activityDays = await listConversationActivityDays(start, end);
  const [completedRetain, completedLegacyLight] = await Promise.all([
    listCompletedStepDays({
      pipeline_id: MEMORY_MAINTENANCE_PIPELINE_ID,
      step_id: RETAIN_CATCH_UP_STEP_ID,
      from_day: start,
      to_day: end,
    }),
    listCompletedStepDays({
      pipeline_id: LEGACY_SLEEP_CYCLE_PIPELINE_ID,
      step_id: LEGACY_LIGHT_SLEEP_STEP_ID,
      from_day: start,
      to_day: end,
    }),
  ]);
  const completedLight = new Set([...completedRetain, ...completedLegacyLight]);
  const temporalRows = await listTemporalSummariesInRange({
    window: "day",
    period_start_from: start,
    period_start_to: end,
  });

  const computed = computeSleepCatchUpDays({
    activityDays,
    completedLightDays: completedLight,
    existingTemporalDays: new Set(temporalRows.map((r) => r.period_start)),
    from: start,
    to: end,
  });

  if (computed.light_days.length === 0 && computed.temporal_days.length === 0) {
    return { ok: false, reason: "nothing_to_catch_up" };
  }

  return {
    ok: true,
    plan: {
      start,
      end,
      ...computed,
    },
  };
}
