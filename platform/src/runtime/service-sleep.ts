import type { CronLogListOpts, CronLogRow } from "@freeanima/core/repos";
import { formatCstIso } from "@freeanima/core/util";
import {
  buildSleepSummary,
  listDeepSleepRoundLogs,
  SLEEP_CYCLE_JOB_ID,
  SLEEP_JOB_IDS,
  sleepStepJobId,
  type SleepSummary,
} from "@freeanima/capabilities-memory";
import type { PipelineRunState } from "@freeanima/runtime/pipeline";

import {
  getSleepPipelineStatus as readSleepPipelineStatus,
  resolveSleepCycleDay,
  runSleepCycle,
  runSleepStep,
} from "../boot/pipeline-handlers.ts";
import { sleepCycleDefinition, SLEEP_CYCLE_PIPELINE_ID } from "../boot/sleep-cycle.ts";
import type { RuntimeDeps } from "./runtime-deps.ts";
import { listCronJobs } from "./service-status.ts";

let sleepCycleRunning = false;
let lastSleepCycleResult: Awaited<ReturnType<typeof runSleepCycle>> | null = null;
let sleepStepRunning = false;

async function appendSleepRunLog(
  deps: RuntimeDeps,
  input: {
    job_id: string;
    ok: boolean;
    output?: Record<string, unknown>;
    error?: string;
  },
): Promise<void> {
  if (!deps.engine.repos.pgAvailable) return;

  await deps.engine.repos.cronLog.append({
    job_id: input.job_id,
    run_count: 0,
    ok: input.ok,
    finished_at: formatCstIso(),
    output: input.ok ? (input.output ?? null) : null,
    error: input.ok ? null : (input.error ?? "sleep run failed"),
  });
}

function cycleLogOutput(
  result: Awaited<ReturnType<typeof runSleepCycle>>,
): Record<string, unknown> {
  return {
    source: "manual",
    day: result.day,
    status: result.status,
    steps: Object.fromEntries(
      Object.entries(result.steps).map(([id, s]) => [
        id,
        { status: s.status, error: s.error, skipped_reason: s.skipped_reason },
      ]),
    ),
  };
}

function stepLogOutput(
  stepId: string,
  day: string,
  result: Awaited<ReturnType<typeof runSleepStep>>,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    source: "manual",
    step_id: stepId,
    day,
    status: result.status,
  };
  if (result.output && typeof result.output === "object" && !Array.isArray(result.output)) {
    Object.assign(base, result.output as Record<string, unknown>);
  }
  if (result.skipped_reason) base.skipped_reason = result.skipped_reason;
  return base;
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

export async function startSleepCycle(
  deps: RuntimeDeps,
  opts?: { day?: string },
): Promise<{ ok: true; started: true } | { ok: false; error: string }> {
  if (sleepCycleRunning || sleepStepRunning) {
    return { ok: false, error: "sleep pipeline already running" };
  }

  sleepCycleRunning = true;
  lastSleepCycleResult = null;

  void (async () => {
    try {
      lastSleepCycleResult = await runSleepCycle(opts?.day);
      await appendSleepRunLog(deps, {
        job_id: SLEEP_CYCLE_JOB_ID,
        ok: lastSleepCycleResult.ok,
        output: cycleLogOutput(lastSleepCycleResult),
        error: lastSleepCycleResult.ok ? undefined : lastSleepCycleResult.status,
      });
    } finally {
      sleepCycleRunning = false;
    }
  })();

  return { ok: true, started: true };
}

export async function startSleepPipelineStep(
  deps: RuntimeDeps,
  opts: {
    stepId: string;
    day?: string;
    force?: boolean;
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

  const resolvedDay = resolveSleepCycleDay(opts.day);

  sleepStepRunning = true;
  try {
    const result = await runSleepStep(opts.stepId, {
      day: opts.day,
      force: opts.force,
    });
    await appendSleepRunLog(deps, {
      job_id: sleepStepJobId(opts.stepId),
      ok: result.ok,
      output: stepLogOutput(opts.stepId, resolvedDay, result),
      error: result.error ?? result.dependency_error,
    });
    return { ok: true, result };
  } finally {
    sleepStepRunning = false;
  }
}
