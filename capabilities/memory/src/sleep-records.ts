import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/core/config";
import { safeParseOrNull } from "@freeanima/core/util";
import { z } from "zod";

import { readDeepSleepState, type DeepSleepState } from "./deep-sleep/state.ts";
import { readLightSleepState, type LightSleepState } from "./light-sleep/state.ts";
import type { DeepSleepRoundLog } from "./deep-sleep/types.ts";

const roundLogSchema = z.object({
  day: z.string(),
  round: z.string(),
  round_index: z.number(),
  started_at: z.string(),
  finished_at: z.string(),
  input: z.record(z.string(), z.unknown()),
  output: z.object({
    tool_calls: z.number(),
    summary: z.string(),
  }),
  change_log_snapshot: z.record(z.string(), z.unknown()),
});

const SLEEP_JOB_IDS = ["builtin-light-sleep", "builtin-deep-sleep"] as const;

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

export function listDeepSleepRoundLogs(day: string): DeepSleepRoundLog[] {
  const dir = join(PATHS.home, "logs");
  if (!existsSync(dir)) return [];

  const prefix = `deep_sleep_${day}_`;
  const files = readdirSync(dir)
    .filter((name) => name.startsWith(prefix) && name.endsWith(".json"))
    .toSorted();

  const logs: DeepSleepRoundLog[] = [];
  for (const file of files) {
    try {
      const raw: unknown = JSON.parse(readFileSync(join(dir, file), "utf-8"));
      const parsed = safeParseOrNull(roundLogSchema, raw);
      if (parsed) logs.push(parsed as DeepSleepRoundLog);
    } catch {
      /* skip corrupt log */
    }
  }
  return logs;
}

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

export { SLEEP_JOB_IDS };
