import { logComponent } from "@freeanima/service-logging";
import type { SessionStorePort } from "@freeanima/engine-repos";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { getMemorySessionStore } from "../session-port.ts";
import {
  buildLightSleepUserMessages,
  buildLimbicPhaseUserMessages,
  collectSessionBlocks,
  cstDayRange,
  formatDialogueMessage,
} from "./build-messages.ts";
import { recordLightSleepRun } from "./state.ts";
import { runLightSleepEngine } from "../light-sleep-port.ts";

export type LightSleepResult = {
  ok: boolean;
  day: string;
  sessions: number;
  truncated_sessions: number;
  tool_calls: number;
  limbic_tool_calls?: number;
  summary: string;
  skipped?: string;
};

export type RunLightSleepOpts = {
  sessionStore?: SessionStorePort;
  selfContent: string;
  day?: string;
};

const LIGHT_SLEEP_TOOL_NAMES = [
  "create_semantic_memory",
  "update_semantic_memory",
  "deprecate_semantic_memory",
] as const;

const LIMBIC_TOOL_NAMES = ["create_limbic_memory"] as const;

export async function runLightSleep(opts: RunLightSleepOpts): Promise<LightSleepResult> {
  const sessionStore = opts.sessionStore ?? getMemorySessionStore();
  const range = cstDayRange(opts.day);
  const sessionIds = await sessionStore.listSessionIdsUpdatedBetween(range.fromIso, range.toIso);

  if (!sessionIds.length) {
    const result: LightSleepResult = {
      ok: true,
      day: range.day,
      sessions: 0,
      truncated_sessions: 0,
      tool_calls: 0,
      summary: "本日无 session 活动，跳过浅睡",
      skipped: "no_sessions",
    };
    recordLightSleepRun({
      day: range.day,
      sessionIds: [],
      truncatedSessions: 0,
      toolCalls: 0,
    });
    return result;
  }

  const blocks = await collectSessionBlocks(sessionStore, sessionIds);
  const dialogue = formatDialogueMessage(blocks);
  const userMessages = await buildLightSleepUserMessages(sessionStore, sessionIds);
  const parts = await decomposeSystemPromptParts(opts.selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);

  logComponent("memory").info("浅睡 Phase 1 开始", {
    day: range.day,
    sessions: sessionIds.length,
    truncated_sessions: dialogue.truncatedSessions,
  });

  const phase1 = await runLightSleepEngine({
    systemPrompt,
    userMessages,
    toolNames: [...LIGHT_SLEEP_TOOL_NAMES],
  });

  let limbicToolCalls = 0;
  let summary = phase1.summary;

  if (phase1.tool_calls > 0) {
    logComponent("memory").info("浅睡 Phase 2 开始", {
      day: range.day,
      semantic_memory_ids: phase1.semantic_memory_ids,
    });

    const limbicMessages = buildLimbicPhaseUserMessages(sessionIds, phase1.semantic_memory_ids);
    const phase2 = await runLightSleepEngine({
      systemPrompt,
      userMessages: limbicMessages,
      toolNames: [...LIMBIC_TOOL_NAMES],
    });
    limbicToolCalls = phase2.tool_calls;
    if (phase2.summary.trim()) {
      summary = `${summary} | 情感：${phase2.summary}`.slice(0, 2000);
    }
  } else {
    logComponent("memory").info("浅睡 Phase 2 跳过", {
      day: range.day,
      reason: "phase1_no_tool_calls",
    });
  }

  recordLightSleepRun({
    day: range.day,
    sessionIds,
    truncatedSessions: dialogue.truncatedSessions,
    toolCalls: phase1.tool_calls + limbicToolCalls,
  });

  const result: LightSleepResult = {
    ok: true,
    day: range.day,
    sessions: sessionIds.length,
    truncated_sessions: dialogue.truncatedSessions,
    tool_calls: phase1.tool_calls,
    limbic_tool_calls: limbicToolCalls,
    summary,
  };

  logComponent("memory").info("浅睡完成", result);
  return result;
}
