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

/**
 * 按 Anima 分别算缺口再求并集。
 * 卧室补跑写带 agent_subject_id 的水位；实例级水位（无 agent）对所有 Anima 视为已完成。
 */
export async function planSleepCatchUp(opts?: {
  nowMs?: number;
  agent_subject_id?: number;
}): Promise<{ ok: true; plan: SleepCatchUpPlan } | { ok: false; reason: string }> {
  const end = todayCstDay(opts?.nowMs);
  const { assertBindableAgentSubject, listEnabledBoundAgents } =
    await import("@freeanima/habitat/engine/conversation/resolve-conversation-agent.ts");
  const agents =
    opts?.agent_subject_id != null && opts.agent_subject_id > 0
      ? [await assertBindableAgentSubject(opts.agent_subject_id)]
      : await listEnabledBoundAgents();
  if (agents.length === 0) {
    return { ok: false, reason: "no_agents" };
  }

  const lightSet = new Set<string>();
  const temporalSet = new Set<string>();
  let start: string | null = null;

  for (const agent of agents) {
    const agentFilter = { agent_subject_id: agent.agent_subject_id };
    const agentStart =
      (await getEarliestConversationDay(agentFilter)) ??
      (agents.length === 1 ? await getEarliestMessageDay() : null);
    if (!agentStart) continue;
    if (start == null || agentStart < start) start = agentStart;
    if (agentStart > end) continue;

    const activityDays = await listConversationActivityDays(agentStart, end, agentFilter);
    const [completedRetain, completedLegacyLight] = await Promise.all([
      listCompletedStepDays({
        pipeline_id: MEMORY_MAINTENANCE_PIPELINE_ID,
        step_id: RETAIN_CATCH_UP_STEP_ID,
        from_day: agentStart,
        to_day: end,
        agent_subject_id: agent.agent_subject_id,
      }),
      listCompletedStepDays({
        pipeline_id: LEGACY_SLEEP_CYCLE_PIPELINE_ID,
        step_id: LEGACY_LIGHT_SLEEP_STEP_ID,
        from_day: agentStart,
        to_day: end,
        agent_subject_id: agent.agent_subject_id,
      }),
    ]);
    const completedLight = new Set([...completedRetain, ...completedLegacyLight]);

    const rows = await listTemporalSummariesInRange({
      window: "day",
      period_start_from: agentStart,
      period_start_to: end,
      world_id: agent.agent_world_id,
    });
    const existingTemporal = new Set<string>(rows.map((r) => r.period_start));

    const computed = computeSleepCatchUpDays({
      activityDays,
      completedLightDays: completedLight,
      existingTemporalDays: existingTemporal,
      from: agentStart,
      to: end,
    });
    for (const d of computed.light_days) lightSet.add(d);
    for (const d of computed.temporal_days) temporalSet.add(d);
  }

  if (!start) {
    return { ok: false, reason: "no_conversations_or_messages" };
  }
  if (start > end) {
    return { ok: false, reason: "start_after_end" };
  }

  const light_days = [...lightSet].toSorted();
  const temporal_days = [...temporalSet].toSorted();
  const days = [...new Set([...light_days, ...temporal_days])].toSorted();
  const cascade_days =
    light_days.length > 0 || temporal_days.length > 0 ? listMonthStartsInRange(start, end) : [];

  if (light_days.length === 0 && temporal_days.length === 0) {
    return { ok: false, reason: "nothing_to_catch_up" };
  }

  return {
    ok: true,
    plan: {
      start,
      end,
      light_days,
      temporal_days,
      cascade_days,
      days,
    },
  };
}
