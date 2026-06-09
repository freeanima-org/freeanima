import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { formatCstIso } from "@freeanima/kernel-util";
import { z } from "zod";
import { safeParseOrNull } from "@freeanima/kernel-util";

const stateSchema = z.object({
  from_day: z.string().optional(),
  to_day: z.string().optional(),
  completed_days: z.array(z.string()).default([]),
  last_error_day: z.string().nullable().optional(),
  updated_at: z.string().optional(),
});

export type LightSleepBackfillState = z.infer<typeof stateSchema>;

function statePath(): string {
  return join(PATHS.home, "runtime", "light_sleep_backfill_state.json");
}

export function readLightSleepBackfillState(): LightSleepBackfillState {
  const p = statePath();
  if (!existsSync(p)) return { completed_days: [] };
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return safeParseOrNull(stateSchema, raw) ?? { completed_days: [] };
  } catch {
    return { completed_days: [] };
  }
}

export function writeLightSleepBackfillState(state: LightSleepBackfillState): void {
  mkdirSync(join(PATHS.home, "runtime"), { recursive: true });
  writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function recordLightSleepBackfillProgress(input: {
  fromDay: string;
  toDay: string;
  completedDays: string[];
  lastErrorDay: string | null;
}): void {
  writeLightSleepBackfillState({
    from_day: input.fromDay,
    to_day: input.toDay,
    completed_days: input.completedDays,
    last_error_day: input.lastErrorDay,
    updated_at: formatCstIso(),
  });
}
