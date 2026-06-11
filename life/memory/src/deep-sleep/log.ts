import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/engine-config";
import type { DeepSleepRound, DeepSleepRoundLog, DeepSleepChangeLog } from "./types.ts";

function logsDir(): string {
  return join(PATHS.home, "logs");
}

/** Write an operation log after each round */
export function writeDeepSleepRoundLog(log: DeepSleepRoundLog): void {
  const dir = logsDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const fileName = `deep_sleep_${log.day}_${String(log.round_index).padStart(2, "0")}_${log.round}.json`;
  writeFileSync(join(dir, fileName), JSON.stringify(log, null, 2), "utf-8");
}

/** Create a log entry */
export function makeRoundLog(input: {
  day: string;
  round: DeepSleepRound;
  roundIndex: number;
  startedAt: string;
  finishedAt: string;
  activeMemoryCount: number;
  changeLogBefore: DeepSleepChangeLog;
  toolCalls: number;
  summary: string;
  changeLogAfter: DeepSleepChangeLog;
}): DeepSleepRoundLog {
  return {
    day: input.day,
    round: input.round,
    round_index: input.roundIndex,
    started_at: input.startedAt,
    finished_at: input.finishedAt,
    input: {
      active_memory_count: input.activeMemoryCount,
      prior_deprecated_count: input.changeLogBefore.deprecatedIds.length,
      prior_added_count: input.changeLogBefore.addedIds.length,
      prior_modified_count: input.changeLogBefore.modifiedIds.length,
    },
    output: {
      tool_calls: input.toolCalls,
      summary: input.summary,
    },
    change_log_snapshot: input.changeLogAfter,
  };
}
