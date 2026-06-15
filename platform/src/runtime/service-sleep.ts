import type { CronLogListOpts, CronLogRow } from "@freeanima/core/repos";
import {
  buildSleepSummary,
  listDeepSleepRoundLogs,
  readLightSleepBackfillState,
  runLightSleepBackfill,
  SLEEP_JOB_IDS,
  type LightSleepBackfillResult,
  type SleepSummary,
} from "@freeanima/capabilities-memory";
import { loadSelfLayerPrompt } from "@freeanima/capabilities-identity";
import type { PipelineRunState } from "@freeanima/runtime/pipeline";

import {
  getSleepPipelineStatus as readSleepPipelineStatus,
  runSleepCycle,
  runSleepStep,
} from "../boot/pipeline-handlers.ts";
import { sleepCycleDefinition, SLEEP_CYCLE_PIPELINE_ID } from "../boot/sleep-cycle.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { listCronJobs } from "./service-status.ts";

let backfillRunning = false;
let lastBackfillResult: LightSleepBackfillResult | null = null;
let sleepCycleRunning = false;
let lastSleepCycleResult: Awaited<ReturnType<typeof runSleepCycle>> | null = null;
let sleepStepRunning = false;

export type LightSleepBackfillStatus = {
  running: boolean;
  from_day?: string;
  to_day?: string;
  completed_days: string[];
  last_error_day?: string | null;
  updated_at?: string;
  last_result?: LightSleepBackfillResult | null;
};

export async function startLightSleepBackfill(
  deps: RuntimeDeps,
  opts?: {
    fromDay?: string;
    toDay?: string;
    resume?: boolean;
  },
): Promise<{ ok: true; started: true } | { ok: false; error: string }> {
  if (backfillRunning) {
    return { ok: false, error: "light sleep backfill already running" };
  }

  backfillRunning = true;
  lastBackfillResult = null;

  void (async () => {
    try {
      const selfContent = await loadSelfLayerPrompt();
      lastBackfillResult = await runLightSleepBackfill({
        sessionStore: deps.engine.repos.session,
        semanticStore: deps.engine.repos.semanticMemory,
        autoStore: deps.engine.repos.autobiographicalMemory,
        selfStore: deps.engine.repos.selfLayer,
        selfContent,
        fromDay: opts?.fromDay,
        toDay: opts?.toDay,
        resume: Boolean(opts?.resume),
      });
    } finally {
      backfillRunning = false;
    }
  })();

  return { ok: true, started: true };
}

export function getLightSleepBackfillStatus(): LightSleepBackfillStatus {
  const state = readLightSleepBackfillState();
  return {
    running: backfillRunning,
    from_day: state.from_day,
    to_day: state.to_day,
    completed_days: state.completed_days,
    last_error_day: state.last_error_day ?? null,
    updated_at: state.updated_at,
    last_result: lastBackfillResult,
  };
}

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

export async function listSleepRuns(
  deps: RuntimeDeps,
  opts?: {
    limit?: number;
    offset?: number;
    ok?: boolean;
  },
): Promise<{ items: CronLogRow[]; total: number }> {
  const listOpts: CronLogListOpts = {
    job_ids: [...SLEEP_JOB_IDS],
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
    ok: opts?.ok,
  };
  const items = await deps.engine.repos.cronLog.list(listOpts);
  return { items, total: items.length };
}

export async function listCronLogs(
  deps: RuntimeDeps,
  opts?: {
    job_id?: string;
    limit?: number;
    offset?: number;
    ok?: boolean;
  },
): Promise<{ items: CronLogRow[]; total: number }> {
  if (!deps.engine.repos.pgAvailable) {
    return { items: [], total: 0 };
  }

  const items = await deps.engine.repos.cronLog.list({
    job_id: opts?.job_id,
    limit: opts?.limit ?? 50,
    offset: opts?.offset ?? 0,
    ok: opts?.ok,
  });
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

export async function startSleepCycle(opts?: {
  day?: string;
}): Promise<{ ok: true; started: true } | { ok: false; error: string }> {
  if (sleepCycleRunning || sleepStepRunning) {
    return { ok: false, error: "sleep pipeline already running" };
  }
  if (backfillRunning) {
    return { ok: false, error: "light sleep backfill already running" };
  }

  sleepCycleRunning = true;
  lastSleepCycleResult = null;

  void (async () => {
    try {
      lastSleepCycleResult = await runSleepCycle(opts?.day);
    } finally {
      sleepCycleRunning = false;
    }
  })();

  return { ok: true, started: true };
}

export async function startSleepPipelineStep(opts: {
  stepId: string;
  day?: string;
  force?: boolean;
}): Promise<
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
      day: opts.day,
      force: opts.force,
    });
    return { ok: true, result };
  } finally {
    sleepStepRunning = false;
  }
}
