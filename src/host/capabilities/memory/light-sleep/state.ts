import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PATHS } from "@freeanima/host/core/config";
import { formatCstIso } from "@freeanima/host/core/util";
import { z } from "zod";
import { safeParseOrNull } from "@freeanima/host/core/util";

const stateSchema = z.object({
  last_run_at: z.string().optional(),
  last_day: z.string().optional(),
  conversation_ids: z.array(z.string()).default([]),
  stats: z
    .object({
      sessions: z.number().optional(),
      truncated_sessions: z.number().optional(),
      tool_calls: z.number().optional(),
      limbic_tool_calls: z.number().optional(),
      /** @deprecated autobiography extraction retired */
      autobiography_tool_calls: z.number().optional(),
      /** @deprecated autobiography extraction retired */
      narratives_created: z.number().optional(),
      /** @deprecated autobiography summary block retired */
      summary_refreshed: z.boolean().optional(),
    })
    .optional(),
});

export type LightSleepState = z.infer<typeof stateSchema>;

function statePath(): string {
  return join(PATHS.home, "runtime", "light_sleep_state.json");
}

export function readLightSleepState(): LightSleepState {
  const p = statePath();
  if (!existsSync(p)) return { conversation_ids: [] };
  try {
    const raw: unknown = JSON.parse(readFileSync(p, "utf-8"));
    return safeParseOrNull(stateSchema, raw) ?? { conversation_ids: [] };
  } catch {
    return { conversation_ids: [] };
  }
}

export function writeLightSleepState(state: LightSleepState): void {
  mkdirSync(join(PATHS.home, "runtime"), { recursive: true });
  writeFileSync(statePath(), JSON.stringify(state, null, 2), "utf-8");
}

export function recordLightSleepRun(input: {
  day: string;
  conversationIds: string[];
  truncatedConversations: number;
  toolCalls: number;
  limbicToolCalls: number;
}): void {
  writeLightSleepState({
    last_run_at: formatCstIso(),
    last_day: input.day,
    conversation_ids: input.conversationIds,
    stats: {
      sessions: input.conversationIds.length,
      truncated_sessions: input.truncatedConversations,
      tool_calls: input.toolCalls,
      limbic_tool_calls: input.limbicToolCalls,
    },
  });
}
