import { readDeepSleepState, type DeepSleepState } from "./reflect/state.ts";

const MEMORY_MAINTENANCE_JOB_ID = "builtin-memory-maintenance" as const;

const SLEEP_JOB_IDS = [MEMORY_MAINTENANCE_JOB_ID] as const;

export type SleepSummary = {
  /** reflect 最近一次运行状态（文件仍为 deep_sleep_state.json） */
  reflect: DeepSleepState;
  cron_jobs: Array<{
    id: string;
    name: string;
    paused: boolean;
    run_count: number;
    last_run_at: string | null;
  }>;
};

export function buildSleepSummary(
  cronJobs: Array<{
    id: string;
    name: string;
    paused: boolean;
    run_count: number;
    last_run_at: string | null;
  }>,
): SleepSummary {
  const sleepJobs = cronJobs.filter((j) => (SLEEP_JOB_IDS as readonly string[]).includes(j.id));
  return {
    reflect: readDeepSleepState(),
    cron_jobs: sleepJobs,
  };
}

export { SLEEP_JOB_IDS, MEMORY_MAINTENANCE_JOB_ID };
