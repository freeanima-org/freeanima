import { omitUndefined } from "@freeanima/habitat/core/util";
import { isPostgresPrimary } from "@freeanima/habitat/core/db/pg";
import { listCronLogs as listPgCronLogs } from "@freeanima/habitat/core/db/pg/cron";
import { acquireRedisLock } from "@freeanima/habitat/core/redis";
import {
  getInprocessBuiltinStatus,
  MEMORY_MAINTENANCE_LOCK_KEY,
  MEMORY_MAINTENANCE_LOCK_TTL_MS,
} from "@freeanima/habitat/capabilities/connectors/cron";
import {
  buildSleepSummary,
  MEMORY_MAINTENANCE_JOB_ID,
  type SleepSummary,
} from "@freeanima/habitat/capabilities/memory";
import type { SleepCatchUpPlan } from "@freeanima/habitat/capabilities/memory/sleep-catch-up-types";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";

import {
  runMemoryMaintenance,
  runMemoryMaintenanceStep,
  type MaintenanceCycleResult,
  type MaintenanceStepResult,
} from "../boot/pipeline-handlers.ts";
import {
  MEMORY_MAINTENANCE_PIPELINE_ID,
  MAINTENANCE_STEP_IDS,
  MAINTENANCE_STEP_LIST,
  isKnownMaintenanceStep,
} from "../boot/memory-maintenance.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { listCronJobs } from "./service-status.ts";

async function acquireMemoryMaintenanceLock() {
  return acquireRedisLock({
    key: MEMORY_MAINTENANCE_LOCK_KEY,
    ttlMs: MEMORY_MAINTENANCE_LOCK_TTL_MS,
    renew: true,
    mode: "try",
  });
}

let cycleRunning = false;
let lastCycleResult: MaintenanceCycleResult | null = null;
let stepRunning = false;
let catchUpRunning = false;

export type MemoryCatchUpStatus = {
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

let catchUpStatus: MemoryCatchUpStatus = {
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

export async function getMemoryMaintenanceSummary(): Promise<SleepSummary> {
  const { jobs } = await listCronJobs();
  const mapped = jobs.map((j) => ({
    id: j.id,
    name: j.name,
    paused: j.paused,
    run_count: j.run_count,
    last_run_at: j.last_run_at > 0 ? new Date(j.last_run_at * 1000).toISOString() : null,
  }));
  const inprocess = getInprocessBuiltinStatus(MEMORY_MAINTENANCE_JOB_ID);
  if (inprocess && !mapped.some((j) => j.id === MEMORY_MAINTENANCE_JOB_ID)) {
    mapped.push({
      id: inprocess.id,
      name: inprocess.name,
      paused: inprocess.paused,
      run_count: inprocess.run_count,
      last_run_at:
        inprocess.last_run_at > 0 ? new Date(inprocess.last_run_at * 1000).toISOString() : null,
    });
  }
  return buildSleepSummary(mapped);
}

export type MemoryMaintenanceStatus = {
  running: boolean;
  step_running: boolean;
  catch_up_running: boolean;
  pipeline_id: string;
  steps: readonly string[];
  last_result: MaintenanceCycleResult | null;
  catch_up: MemoryCatchUpStatus;
};

export function getMemoryMaintenanceStatus(): MemoryMaintenanceStatus {
  return {
    running: cycleRunning,
    step_running: stepRunning,
    catch_up_running: catchUpRunning,
    pipeline_id: MEMORY_MAINTENANCE_PIPELINE_ID,
    steps: MAINTENANCE_STEP_LIST,
    last_result: lastCycleResult,
    catch_up: { ...catchUpStatus },
  };
}

function maintenanceBusy(): boolean {
  return cycleRunning || stepRunning || catchUpRunning;
}

export async function startMemoryMaintenanceCycle(
  deps: RuntimeDeps,
  opts?: { day?: string; reflect_mode?: "full" | "incremental" },
): Promise<{ ok: true; started: true } | { ok: false; error: string }> {
  if (maintenanceBusy()) {
    return { ok: false, error: "memory maintenance already running" };
  }

  const lock = await acquireMemoryMaintenanceLock();
  if (lock.status === "busy") {
    return { ok: false, error: "memory maintenance already running" };
  }

  cycleRunning = true;
  lastCycleResult = null;

  void (async () => {
    try {
      lastCycleResult = await runMemoryMaintenance(deps.engine, opts?.day, {
        trigger: "manual_cycle",
        ...omitUndefined({ reflect_mode: opts?.reflect_mode }),
      });
    } finally {
      await lock.handle.release();
      cycleRunning = false;
    }
  })();

  return { ok: true, started: true };
}

export async function startMemoryMaintenanceStep(
  deps: RuntimeDeps,
  opts: {
    stepId: string;
    day?: string;
    force?: boolean;
    reflect_mode?: "full" | "incremental";
    agent_subject_id?: number;
  },
): Promise<{ ok: true; result: MaintenanceStepResult } | { ok: false; error: string }> {
  if (maintenanceBusy()) {
    return { ok: false, error: "memory maintenance already running" };
  }

  if (!isKnownMaintenanceStep(opts.stepId)) {
    return { ok: false, error: `unknown maintenance step: ${opts.stepId}` };
  }

  const lock = await acquireMemoryMaintenanceLock();
  if (lock.status === "busy") {
    return { ok: false, error: "memory maintenance already running" };
  }

  stepRunning = true;
  try {
    const result = await runMemoryMaintenanceStep(opts.stepId, {
      ...omitUndefined({
        day: opts.day,
        force: opts.force,
        reflect_mode: opts.reflect_mode,
        agent_subject_id: opts.agent_subject_id,
      }),
      trigger: "manual_step",
      engine: deps.engine,
    });
    if (!result.ok) {
      return { ok: false, error: result.error ?? `step failed: ${opts.stepId}` };
    }
    return { ok: true, result };
  } finally {
    await lock.handle.release();
    stepRunning = false;
  }
}

export async function startMemoryMaintenanceCatchUp(
  deps: RuntimeDeps,
  opts?: { plan?: SleepCatchUpPlan; agent_subject_id?: number },
): Promise<{ ok: true; started: true; plan: SleepCatchUpPlan } | { ok: false; error: string }> {
  if (maintenanceBusy()) {
    return { ok: false, error: "memory maintenance already running" };
  }
  if (!isPostgresPrimary()) {
    return { ok: false, error: "postgres primary required for memory catch-up" };
  }

  let plan: SleepCatchUpPlan;
  if (opts?.plan) {
    plan = opts.plan;
  } else {
    const { planSleepCatchUp } =
      await import("@freeanima/habitat/capabilities/memory/sleep-catch-up.ts");
    const planned: { ok: true; plan: SleepCatchUpPlan } | { ok: false; reason: string } =
      await planSleepCatchUp(omitUndefined({ agent_subject_id: opts?.agent_subject_id }));
    if (!planned.ok) {
      return { ok: false, error: planned.reason };
    }
    plan = planned.plan;
  }

  const lock = await acquireMemoryMaintenanceLock();
  if (lock.status === "busy") {
    return { ok: false, error: "memory maintenance already running" };
  }

  const agentSubjectId = opts?.agent_subject_id;
  catchUpRunning = true;
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
            current_step: MAINTENANCE_STEP_IDS.retainCatchUp,
          };
          const result = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.retainCatchUp, {
            day,
            force: true,
            trigger: "catch_up",
            engine: deps.engine,
            ...omitUndefined({ agent_subject_id: agentSubjectId }),
          });
          if (!result.ok) {
            throw new Error(result.error ?? `retain-catch-up failed for ${day}`);
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
            current_step: MAINTENANCE_STEP_IDS.temporalSummaryDay,
          };
          const result = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.temporalSummaryDay, {
            day,
            force: true,
            trigger: "catch_up",
            engine: deps.engine,
            ...omitUndefined({ agent_subject_id: agentSubjectId }),
          });
          if (!result.ok) {
            throw new Error(result.error ?? `temporal-summary-day failed for ${day}`);
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
          current_step: MAINTENANCE_STEP_IDS.temporalSummaryCascade,
        };
        const result = await runMemoryMaintenanceStep(MAINTENANCE_STEP_IDS.temporalSummaryCascade, {
          day,
          force: true,
          trigger: "catch_up",
          engine: deps.engine,
          ...omitUndefined({ agent_subject_id: agentSubjectId }),
        });
        if (!result.ok) {
          throw new Error(result.error ?? `temporal-summary-cascade failed for ${day}`);
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
      logComponent("memory").warn("memory catch-up failed", { error: message });
      catchUpStatus = {
        ...catchUpStatus,
        running: false,
        error: message,
        finished: true,
      };
      void notifySoftFailure({
        sourceRef: cstDaySourceRef("memory_maintenance:catch_up_failed"),
        title: "记忆补跑失败",
        body: ["一键补跑中途失败；已记录状态，可稍后重试。", `错误：${message}`].join("\n"),
        payload: { kind: "memory_catch_up_failed", error: message },
        logLabel: "memory_catch_up",
      });
    } finally {
      await lock.handle.release();
      catchUpRunning = false;
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
