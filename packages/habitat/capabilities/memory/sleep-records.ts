import { readDeepSleepState, type DeepSleepState } from "./deep-sleep/state.ts";
import { readLightSleepState, type LightSleepState } from "./light-sleep/state.ts";

const MEMORY_MAINTENANCE_JOB_ID = "builtin-memory-maintenance" as const;
/** @deprecated 旧 cron id */
const SLEEP_CYCLE_JOB_ID = MEMORY_MAINTENANCE_JOB_ID;

const SLEEP_JOB_IDS = [MEMORY_MAINTENANCE_JOB_ID] as const;

export type SleepSummary = {
  /** @deprecated 兼容运维页；现为 retain 水位相关状态文件 */
  light_sleep: LightSleepState;
  /** @deprecated 兼容运维页；现为 reflect 状态 */
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

export { SLEEP_JOB_IDS, SLEEP_CYCLE_JOB_ID, MEMORY_MAINTENANCE_JOB_ID };
