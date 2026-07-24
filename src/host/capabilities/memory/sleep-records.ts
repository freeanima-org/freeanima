import { readDeepSleepState, type DeepSleepState } from "./deep-sleep/state.ts";
import { readLightSleepState, type LightSleepState } from "./light-sleep/state.ts";

const SLEEP_CYCLE_JOB_ID = "builtin-sleep-cycle" as const;

const SLEEP_JOB_IDS = [SLEEP_CYCLE_JOB_ID] as const;

export type SleepSummary = {
  light_sleep: LightSleepState;
  deep_sleep: DeepSleepState;
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
    light_sleep: readLightSleepState(),
    deep_sleep: readDeepSleepState(),
    cron_jobs: sleepJobs,
  };
}

export { SLEEP_JOB_IDS, SLEEP_CYCLE_JOB_ID };
