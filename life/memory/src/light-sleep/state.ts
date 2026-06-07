import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import { formatCstIso } from "@freeanima/kernel-util";
import { z } from "zod";
import { safeParseOrNull } from "@freeanima/kernel-util";

const stateSchema = z.object({
  last_run_at: z.string().optional(),
  last_day: z.string().optional(),
  session_ids: z.array(z.string()).default([]),
  stats: z
    .object({
      sessions: z.number().optional(),
      truncated_sessions: z.number().optional(),
      tool_calls: z.number().optional(),
    })
    .optional(),
});

export type LightSleepState = z.infer<typeof stateSchema>;

function statePath(): string {
  return join(PATHS.home, "runtime", "light_sleep_state.json");
}

export function readLightSleepState(): LightSleepState {
  const p = statePath();
  if (!existsSync(p)) return { session_ids: [] };
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return safeParseOrNull(stateSchema, raw) ?? { session_ids: [] };
  } catch {
    return { session_ids: [] };
  }
}

export function writeLightSleepState(state: LightSleepState): void {
  mkdirSync(join(PATHS.home, "runtime"), { recursive: true });
  writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function recordLightSleepRun(input: {
  day: string;
  sessionIds: string[];
  truncatedSessions: number;
  toolCalls: number;
}): void {
  writeLightSleepState({
    last_run_at: formatCstIso(),
    last_day: input.day,
    session_ids: input.sessionIds,
    stats: {
      sessions: input.sessionIds.length,
      truncated_sessions: input.truncatedSessions,
      tool_calls: input.toolCalls,
    },
  });
}
