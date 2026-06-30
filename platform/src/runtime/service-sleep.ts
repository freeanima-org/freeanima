import { omitUndefined } from "@freeanima/core/util";
import type { PipelineStepRunListOpts, PipelineStepRunRow } from "@freeanima/core/repos";
import { isPostgresPrimary } from "@freeanima/core/db/pg";
import { listPipelineStepRuns as listPgPipelineStepRuns } from "@freeanima/core/db/pg/pipeline";
import { listCronLogs as listPgCronLogs } from "@freeanima/core/db/pg/cron";
import {
  buildSleepSummary,
  listDeepSleepRoundLogs,
  type SleepSummary,
} from "@freeanima/capabilities-memory";
import type { PipelineRunState } from "@freeanima/runtime/pipeline";

import {
  getSleepPipelineStatus as readSleepPipelineStatus,
  runSleepCycle,
  runSleepStep,
} from "../boot/pipeline-handlers.ts";
import { sleepCycleDefinition, SLEEP_CYCLE_PIPELINE_ID } from "../boot/sleep-cycle.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { listCronJobs } from "./service-status.ts";

let sleepCycleRunning = false;
let lastSleepCycleResult: Awaited<ReturnType<typeof runSleepCycle>> | null = null;
let sleepStepRunning = false;

export async function getSleepSummary(): Promise<SleepSummary> {
  const { jobs } = await listCronJobs();
  return buildSleepSummary(
    jobs.map((j) => ({
      id: j.id,
      name: j.name,
      paused: j.paused,
      run_count: j.run_count,
      last_run_at: j.last_run_at > 0 ? new Date(j.last_run_at * 1000).toISOString() : null,
    })),
  );
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

export function getDeepSleepRounds(day: string) {
  return { day, rounds: listDeepSleepRoundLogs(day) };
}

export type SleepPipelineStatus = {
  running: boolean;
  step_running: boolean;
  pipeline_id: string;
  definition: typeof sleepCycleDefinition;
  last_result: Awaited<ReturnType<typeof runSleepCycle>> | null;
  run_state: PipelineRunState | null;
};

export function getSleepPipelineStatus(): SleepPipelineStatus {
  return {
    running: sleepCycleRunning,
    step_running: sleepStepRunning,
    pipeline_id: SLEEP_CYCLE_PIPELINE_ID,
    definition: sleepCycleDefinition,
    last_result: lastSleepCycleResult,
    run_state: readSleepPipelineStatus(),
  };
}

export async function startSleepCycle(
  _deps: RuntimeDeps,
  opts?: { day?: string; deep_sleep_mode?: "full" | "incremental" },
): Promise<{ ok: true; started: true } | { ok: false; error: string }> {
  if (sleepCycleRunning || sleepStepRunning) {
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
  if (sleepCycleRunning || sleepStepRunning) {
    return { ok: false, error: "sleep pipeline already running" };
  }

  const known = sleepCycleDefinition.nodes.some((n) => n.id === opts.stepId);
  if (!known) {
    return { ok: false, error: `unknown sleep step: ${opts.stepId}` };
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
    sleepStepRunning = false;
  }
}

export async function listCronLogs(
  _deps: RuntimeDeps,
  opts?: {
    job_id?: string;
    limit?: number;
    offset?: number;
    ok?: boolean;
  },
): Promise<{ items: import("@freeanima/core/repos").CronLogRow[]; total: number }> {
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
