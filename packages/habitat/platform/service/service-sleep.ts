import { omitUndefined } from "@freeanima/habitat/core/util";
import type {
  PipelineStepRunListOpts,
  PipelineStepRunRow,
} from "@freeanima/habitat/core/db/pg/pipeline/types";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { listPipelineStepRuns as listPgPipelineStepRuns } from "@freeanima/habitat/core/db/pg/pipeline";
import { listCronLogs as listPgCronLogs } from "@freeanima/habitat/core/db/pg/cron";
import { acquireRedisLock } from "@freeanima/habitat/core/redis";
import {
  getInprocessBuiltinStatus,
  SLEEP_PIPELINE_LOCK_KEY,
} from "@freeanima/habitat/capabilities/connectors/cron";
import {
  buildSleepSummary,
  SLEEP_CYCLE_JOB_ID,
  type SleepSummary,
} from "@freeanima/habitat/capabilities/memory";
import type { SleepCatchUpPlan } from "@freeanima/habitat/capabilities/memory/sleep-catch-up-types";
import type { PipelineRunState } from "@freeanima/habitat/engine/pipeline";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";

import {
  getSleepPipelineStatus as readSleepPipelineStatus,
  runSleepCycle,
  runSleepStep,
} from "../boot/pipeline-handlers.ts";
import {
  sleepCycleDefinition,
  SLEEP_CYCLE_PIPELINE_ID,
  SLEEP_STEP_IDS,
} from "../boot/sleep-cycle.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { listCronJobs } from "./service-status.ts";

const SLEEP_PIPELINE_LOCK_TTL_MS = 3 * 60 * 60 * 1000;

async function acquireSleepPipelineLock() {
  return acquireRedisLock({
    key: SLEEP_PIPELINE_LOCK_KEY,
    ttlMs: SLEEP_PIPELINE_LOCK_TTL_MS,
    renew: true,
    mode: "try",
  });
}

let sleepCycleRunning = false;
let lastSleepCycleResult: Awaited<ReturnType<typeof runSleepCycle>> | null = null;
let sleepStepRunning = false;
let sleepCatchUpRunning = false;

export type SleepCatchUpStatus = {
  running: boolean;
  plan: SleepCatchUpPlan | null;
  completed_light_days: string[];
  completed_temporal_days: string[];
  completed_cascade_days: string[];
  current_day: string | null;
  current_step: string | null;
  error: string | null;
  finished: boolean;
};

let catchUpStatus: SleepCatchUpStatus = {
  running: false,
  plan: null,
  completed_light_days: [],
  completed_temporal_days: [],
  completed_cascade_days: [],
  current_day: null,
  current_step: null,
  error: null,
  finished: false,
};

export async function getSleepSummary(): Promise<SleepSummary> {
  const { jobs } = await listCronJobs();
  const mapped = jobs.map((j) => ({
    id: j.id,
    name: j.name,
    paused: j.paused,
    run_count: j.run_count,
    last_run_at: j.last_run_at > 0 ? new Date(j.last_run_at * 1000).toISOString() : null,
  }));
  // sleep-cycle 已迁出 cron_jobs，从进程内 Bun.cron 状态注入
  const sleepInprocess = getInprocessBuiltinStatus(SLEEP_CYCLE_JOB_ID);
  if (sleepInprocess && !mapped.some((j) => j.id === SLEEP_CYCLE_JOB_ID)) {
    mapped.push({
      id: sleepInprocess.id,
      name: sleepInprocess.name,
      paused: sleepInprocess.paused,
      run_count: sleepInprocess.run_count,
      last_run_at:
        sleepInprocess.last_run_at > 0
          ? new Date(sleepInprocess.last_run_at * 1000).toISOString()
          : null,
    });
  }
  return buildSleepSummary(mapped);
}

export async function listPipelineStepRuns(
  _deps: RuntimeDeps,
  opts?: {
    step_id?: string;
    run_id?: string;
    limit?: number;
    offset?: number;
  },
): Promise<{ items: PipelineStepRunRow[]; total: number }> {
  if (!isPostgresPrimary()) {
    return { items: [], total: 0 };
  }

  const listOpts: PipelineStepRunListOpts = {
    pipeline_id: SLEEP_CYCLE_PIPELINE_ID,
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
    ...omitUndefined({
      step_id: opts?.step_id,
      run_id: opts?.run_id,
    }),
  };
  const items = await listPgPipelineStepRuns(listOpts);
  return { items, total: items.length };
}

export type SleepPipelineStatus = {
  running: boolean;
  step_running: boolean;
  catch_up_running: boolean;
  pipeline_id: string;
  definition: typeof sleepCycleDefinition;
  last_result: Awaited<ReturnType<typeof runSleepCycle>> | null;
  run_state: PipelineRunState | null;
  catch_up: SleepCatchUpStatus;
};

export function getSleepPipelineStatus(): SleepPipelineStatus {
  return {
    running: sleepCycleRunning,
    step_running: sleepStepRunning,
    catch_up_running: sleepCatchUpRunning,
    pipeline_id: SLEEP_CYCLE_PIPELINE_ID,
    definition: sleepCycleDefinition,
    last_result: lastSleepCycleResult,
    run_state: readSleepPipelineStatus(),
    catch_up: { ...catchUpStatus },
  };
}

function sleepBusy(): boolean {
  return sleepCycleRunning || sleepStepRunning || sleepCatchUpRunning;
}

export async function startSleepCycle(
  _deps: RuntimeDeps,
  opts?: { day?: string; deep_sleep_mode?: "full" | "incremental" },
): Promise<{ ok: true; started: true } | { ok: false; error: string }> {
  if (sleepBusy()) {
    return { ok: false, error: "sleep pipeline already running" };
  }

  const lock = await acquireSleepPipelineLock();
  if (lock.status === "busy") {
    return { ok: false, error: "sleep pipeline already running" };
  }

  sleepCycleRunning = true;
  lastSleepCycleResult = null;

  void (async () => {
    try {
      lastSleepCycleResult = await runSleepCycle(opts?.day, {
        trigger: "manual_cycle",
        ...omitUndefined({ deep_sleep_mode: opts?.deep_sleep_mode }),
      });
    } finally {
      await lock.handle.release();
      sleepCycleRunning = false;
    }
  })();

  return { ok: true, started: true };
}

export async function startSleepPipelineStep(
  _deps: RuntimeDeps,
  opts: {
    stepId: string;
    day?: string;
    force?: boolean;
    deep_sleep_mode?: "full" | "incremental";
  },
): Promise<
  { ok: true; result: Awaited<ReturnType<typeof runSleepStep>> } | { ok: false; error: string }
> {
  if (sleepBusy()) {
    return { ok: false, error: "sleep pipeline already running" };
  }

  const known = sleepCycleDefinition.nodes.some((n) => n.id === opts.stepId);
  if (!known) {
    return { ok: false, error: `unknown sleep step: ${opts.stepId}` };
  }

  const lock = await acquireSleepPipelineLock();
  if (lock.status === "busy") {
    return { ok: false, error: "sleep pipeline already running" };
  }

  sleepStepRunning = true;
  try {
    const result = await runSleepStep(opts.stepId, {
      ...omitUndefined({
        day: opts.day,
        force: opts.force,
        deep_sleep_mode: opts.deep_sleep_mode,
      }),
      trigger: "manual_step",
    });
    return { ok: true, result };
  } finally {
    await lock.handle.release();
    sleepStepRunning = false;
  }
}

export async function startSleepCatchUp(
  _deps: RuntimeDeps,
  opts?: { plan?: SleepCatchUpPlan },
): Promise<{ ok: true; started: true; plan: SleepCatchUpPlan } | { ok: false; error: string }> {
  if (sleepBusy()) {
    return { ok: false, error: "sleep pipeline already running" };
  }
  if (!isPostgresPrimary()) {
    return { ok: false, error: "postgres primary required for sleep catch-up" };
  }

  let plan: SleepCatchUpPlan;
  if (opts?.plan) {
    plan = opts.plan;
  } else {
    const { planSleepCatchUp } =
      await import("@freeanima/habitat/capabilities/memory/sleep-catch-up.ts");
    const planned: { ok: true; plan: SleepCatchUpPlan } | { ok: false; reason: string } =
      await planSleepCatchUp();
    if (!planned.ok) {
      return { ok: false, error: planned.reason };
    }
    plan = planned.plan;
  }

  const lock = await acquireSleepPipelineLock();
  if (lock.status === "busy") {
    return { ok: false, error: "sleep pipeline already running" };
  }

  sleepCatchUpRunning = true;
  catchUpStatus = {
    running: true,
    plan,
    completed_light_days: [],
    completed_temporal_days: [],
    completed_cascade_days: [],
    current_day: null,
    current_step: null,
    error: null,
    finished: false,
  };

  void (async () => {
    try {
      const lightSet = new Set(plan.light_days);
      const temporalSet = new Set(plan.temporal_days);
      for (const day of plan.days) {
        if (lightSet.has(day)) {
          catchUpStatus = {
            ...catchUpStatus,
            current_day: day,
            current_step: SLEEP_STEP_IDS.lightSleep,
          };
          const result = await runSleepStep(SLEEP_STEP_IDS.lightSleep, {
            day,
            force: true,
            trigger: "catch_up",
          });
          if (!result.ok) {
            throw new Error(
              result.error ?? result.dependency_error ?? `light-sleep failed for ${day}`,
            );
          }
          catchUpStatus = {
            ...catchUpStatus,
            completed_light_days: [...catchUpStatus.completed_light_days, day],
          };
        }
        if (temporalSet.has(day)) {
          catchUpStatus = {
            ...catchUpStatus,
            current_day: day,
            current_step: SLEEP_STEP_IDS.temporalSummaryDay,
          };
          const result = await runSleepStep(SLEEP_STEP_IDS.temporalSummaryDay, {
            day,
            force: true,
            trigger: "catch_up",
          });
          if (!result.ok) {
            throw new Error(
              result.error ?? result.dependency_error ?? `temporal-summary-day failed for ${day}`,
            );
          }
          catchUpStatus = {
            ...catchUpStatus,
            completed_temporal_days: [...catchUpStatus.completed_temporal_days, day],
          };
        }
      }

      for (const day of plan.cascade_days) {
        catchUpStatus = {
          ...catchUpStatus,
          current_day: day,
          current_step: SLEEP_STEP_IDS.temporalSummaryCascade,
        };
        const result = await runSleepStep(SLEEP_STEP_IDS.temporalSummaryCascade, {
          day,
          force: true,
          trigger: "catch_up",
        });
        if (!result.ok) {
          throw new Error(
            result.error ?? result.dependency_error ?? `temporal-summary-cascade failed for ${day}`,
          );
        }
        catchUpStatus = {
          ...catchUpStatus,
          completed_cascade_days: [...catchUpStatus.completed_cascade_days, day],
        };
      }

      catchUpStatus = {
        ...catchUpStatus,
        running: false,
        current_day: null,
        current_step: null,
        finished: true,
      };
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      logComponent("memory").warn("sleep catch-up failed", { error: message });
      catchUpStatus = {
        ...catchUpStatus,
        running: false,
        error: message,
        finished: true,
      };
      void notifySoftFailure({
        sourceRef: cstDaySourceRef("sleep:catch_up_failed"),
        title: "睡眠补跑失败",
        body: ["Catch up sleep 中途失败；已记录状态，可稍后重试。", `错误：${message}`].join("\n"),
        payload: { kind: "sleep_catch_up_failed", error: message },
        logLabel: "sleep_catch_up",
      });
    } finally {
      await lock.handle.release();
      sleepCatchUpRunning = false;
    }
  })();

  return { ok: true, started: true, plan };
}

export async function listCronLogs(
  _deps: RuntimeDeps,
  opts?: {
    job_id?: string;
    limit?: number;
    offset?: number;
    ok?: boolean;
  },
): Promise<{
  items: import("@freeanima/habitat/core/db/pg/cron/types").CronLogRow[];
  total: number;
}> {
  if (!isPostgresPrimary()) {
    return { items: [], total: 0 };
  }

  const items = await listPgCronLogs(
    omitUndefined({
      job_id: opts?.job_id,
      limit: opts?.limit ?? 50,
      offset: opts?.offset ?? 0,
      ok: opts?.ok,
    }),
  );
  return { items, total: items.length };
}
