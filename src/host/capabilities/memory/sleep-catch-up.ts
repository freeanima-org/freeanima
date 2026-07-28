import {
  getEarliestConversationDay,
  getEarliestMessageDay,
  listConversationActivityDays,
} from "@freeanima/host/core/db/pg/conversation";
import { listCompletedStepDays } from "@freeanima/host/core/db/pg/pipeline";
import { listTemporalSummariesInRange } from "@freeanima/host/core/db/pg/temporal-summary";
import { CST_OFFSET_MS } from "@freeanima/host/core/util";

import { isCstMonthEnd } from "./temporal-summary/buckets.ts";
import type { SleepCatchUpPlan } from "./sleep-catch-up-types.ts";

export type { SleepCatchUpPlan } from "./sleep-catch-up-types.ts";

/** Align with sleep-cycle pipeline ids (avoid importing platform from capabilities). */
const SLEEP_CYCLE_PIPELINE_ID = "sleep-cycle";
const LIGHT_SLEEP_STEP_ID = "light-sleep";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Today as CST YYYY-MM-DD */
export function todayCstDay(nowMs: number = Date.now()): string {
  const cst = new Date(nowMs + CST_OFFSET_MS);
  return `${cst.getUTCFullYear()}-${pad2(cst.getUTCMonth() + 1)}-${pad2(cst.getUTCDate())}`;
}

/** Month-end CST dates in [fromDay, toDay] inclusive */
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
    // UTC day 0 of next month = last day of month m
    const last = new Date(Date.UTC(y, m, 0));
    const monthEnd = `${y}-${pad2(m)}-${pad2(last.getUTCDate())}`;
    if (monthEnd >= fromDay && monthEnd <= toDay && isCstMonthEnd(monthEnd)) {
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
  // Cascade only when catching up day work; month-ends in range (handler no-ops if empty)
  const cascade_days =
    light_days.length > 0 || temporal_days.length > 0
      ? listMonthEndsInRange(input.from, input.to)
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
  const completedLight = await listCompletedStepDays({
    pipeline_id: SLEEP_CYCLE_PIPELINE_ID,
    step_id: LIGHT_SLEEP_STEP_ID,
    from_day: start,
    to_day: end,
  });
  const temporalRows = await listTemporalSummariesInRange({
    window: "day",
    period_start_from: start,
    period_start_to: end,
  });

  const computed = computeSleepCatchUpDays({
    activityDays,
    completedLightDays: new Set(completedLight),
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
