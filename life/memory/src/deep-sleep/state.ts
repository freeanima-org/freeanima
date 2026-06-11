import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { formatCstIso } from "@freeanima/engine-util";
import { z } from "zod";
import { safeParseOrNull } from "@freeanima/engine-util";

const stateSchema = z.object({
  last_run_at: z.string().optional(),
  last_day: z.string().optional(),
  rounds_completed: z.number().default(0),
  stats: z
    .object({
      total_tool_calls: z.number().optional(),
      contradiction_expiry_calls: z.number().optional(),
      split_calls: z.number().optional(),
      merge_calls: z.number().optional(),
    })
    .optional(),
});

export type DeepSleepState = z.infer<typeof stateSchema>;

function statePath(): string {
  return join(PATHS.home, "runtime", "deep_sleep_state.json");
}

export function readDeepSleepState(): DeepSleepState {
  const p = statePath();
  if (!existsSync(p)) return { rounds_completed: 0 };
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return safeParseOrNull(stateSchema, raw) ?? { rounds_completed: 0 };
  } catch {
    return { rounds_completed: 0 };
  }
}

export function writeDeepSleepState(state: DeepSleepState): void {
  mkdirSync(join(PATHS.home, "runtime"), { recursive: true });
  writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function recordDeepSleepRun(input: {
  day: string;
  roundsCompleted: number;
  stats: {
    total_tool_calls: number;
    contradiction_expiry_calls?: number;
    split_calls?: number;
    merge_calls?: number;
  };
}): void {
  writeDeepSleepState({
    last_run_at: formatCstIso(),
    last_day: input.day,
    rounds_completed: input.roundsCompleted,
    stats: input.stats,
  });
}
