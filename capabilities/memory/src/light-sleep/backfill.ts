import { logCapability as logComponent } from "@freeanima/storage-config";
import type { SessionStorePort } from "@freeanima/storage-repos";

import { getMemorySessionStore } from "../session-port.ts";
import { cstDayRange } from "./build-messages.ts";
import { runLightSleep, type LightSleepResult, type RunLightSleepOpts } from "./run.ts";
import { readLightSleepBackfillState, recordLightSleepBackfillProgress } from "./backfill-state.ts";

export type RunLightSleepBackfillOpts = RunLightSleepOpts & {
  sessionStore?: SessionStorePort;
  fromDay?: string;
  toDay?: string;
  resume?: boolean;
  refreshSummaryOn?: "last" | "each";
};

export type LightSleepBackfillResult = {
  ok: boolean;
  from_day: string;
  to_day: string;
  days_total: number;
  days_completed: number;
  days_skipped: number;
  days_failed: string[];
  results: LightSleepResult[];
};

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function addCstDay(day: string): string {
  const match = DAY_RE.exec(day.trim());
  if (!match) throw new Error(`invalid day: ${day}`);
  const [y, m, d] = day.split("-").map(Number);
  const next = new Date(Date.UTC(y, m - 1, d + 1));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

export function enumerateCstDays(fromDay: string, toDay: string): string[] {
  if (fromDay > toDay) return [];
  const days: string[] = [];
  let cur = fromDay;
  while (cur <= toDay) {
    days.push(cur);
    if (cur === toDay) break;
    cur = addCstDay(cur);
  }
  return days;
}

/** Default backfill end day: CST yesterday (same as light sleep cron default) */
export function defaultBackfillToDay(): string {
  return cstDayRange().day;
}

export async function resolveBackfillDayRange(
  sessionStore: SessionStorePort,
  opts: Pick<RunLightSleepBackfillOpts, "fromDay" | "toDay">,
): Promise<{ from_day: string; to_day: string }> {
  const toDay = opts.toDay?.trim() || defaultBackfillToDay();
  const fromDay = opts.fromDay?.trim() || (await sessionStore.getEarliestSessionDay());
  if (!fromDay) {
    throw new Error("No sessions available; cannot infer fromDay");
  }
  if (!DAY_RE.test(fromDay) || !DAY_RE.test(toDay)) {
    throw new Error("fromDay/toDay must be YYYY-MM-DD");
  }
  if (fromDay > toDay) {
    throw new Error(`fromDay (${fromDay}) cannot be after toDay (${toDay})`);
  }
  return { from_day: fromDay, to_day: toDay };
}

export async function runLightSleepBackfill(
  opts: RunLightSleepBackfillOpts,
): Promise<LightSleepBackfillResult> {
  const sessionStore = opts.sessionStore ?? getMemorySessionStore();
  const { from_day, to_day } = await resolveBackfillDayRange(sessionStore, opts);
  const allDays = enumerateCstDays(from_day, to_day);
  const refreshSummaryOn = opts.refreshSummaryOn ?? "last";

  const prior = opts.resume ? readLightSleepBackfillState() : { completed_days: [] as string[] };
  const completedSet = new Set(
    opts.resume && prior.from_day === from_day && prior.to_day === to_day
      ? prior.completed_days
      : [],
  );

  const results: LightSleepResult[] = [];
  const daysFailed: string[] = [];
  let daysSkipped = 0;

  logComponent("memory").info("light sleep historical backfill started", {
    from_day,
    to_day,
    days_total: allDays.length,
    resume: Boolean(opts.resume),
    already_completed: completedSet.size,
  });

  for (const day of allDays) {
    if (completedSet.has(day)) {
      daysSkipped += 1;
      continue;
    }

    const isLast = day === to_day;
    const skipSummaryRefresh = refreshSummaryOn === "last" && !isLast;

    try {
      const result = await runLightSleep({
        ...opts,
        sessionStore,
        day,
        skipSummaryRefresh,
      });
      results.push(result);
      completedSet.add(day);
      recordLightSleepBackfillProgress({
        fromDay: from_day,
        toDay: to_day,
        completedDays: [...completedSet].toSorted(),
        lastErrorDay: null,
      });

      if (result.skipped === "no_sessions") {
        daysSkipped += 1;
      }

      logComponent("memory").info("light sleep historical backfill day completed", {
        day,
        sessions: result.sessions,
        tool_calls: result.tool_calls,
        skipped: result.skipped,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      daysFailed.push(day);
      recordLightSleepBackfillProgress({
        fromDay: from_day,
        toDay: to_day,
        completedDays: [...completedSet].toSorted(),
        lastErrorDay: day,
      });
      logComponent("memory").error("light sleep historical backfill day failed", {
        day,
        error: message,
      });
    }
  }

  const result: LightSleepBackfillResult = {
    ok: daysFailed.length === 0,
    from_day,
    to_day,
    days_total: allDays.length,
    days_completed: completedSet.size,
    days_skipped: daysSkipped,
    days_failed: daysFailed,
    results,
  };

  logComponent("memory").info("light sleep historical backfill finished", result);
  return result;
}
