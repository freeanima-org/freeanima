import { logCapability as logComponent } from "@freeanima/host/core/config";
import { listConversationIdsUpdatedBetween } from "@freeanima/host/core/db/pg/conversation";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import {
  buildLightSleepUserMessages,
  buildLimbicUserMessages,
  collectConversationBlocks,
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
  limbic_tool_calls: number;
  summary: string;
  skipped?: string;
};

export type RunLightSleepOpts = {
  selfContent: string;
  day?: string;
};

const LIGHT_SLEEP_TOOL_NAMES = [
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_semantic_deprecate",
] as const;

const LIMBIC_TOOL_NAMES = ["memory_limbic_create"] as const;

function appendSummaryPart(base: string, label: string, part: string): string {
  const trimmed = part.trim();
  if (!trimmed) return base;
  return `${base} | ${label}: ${trimmed}`.slice(0, 2000);
}

export async function runLightSleep(opts: RunLightSleepOpts): Promise<LightSleepResult> {
  const range = cstDayRange(opts.day);
  const conversationIds = await listConversationIdsUpdatedBetween(range.fromIso, range.toIso);

  if (conversationIds.length === 0) {
    const result: LightSleepResult = {
      ok: true,
      day: range.day,
      sessions: 0,
      truncated_sessions: 0,
      tool_calls: 0,
      limbic_tool_calls: 0,
      summary: "No conversation activity today; skipping light sleep",
      skipped: "no_sessions",
    };
    recordLightSleepRun({
      day: range.day,
      conversationIds: [],
      truncatedConversations: 0,
      toolCalls: 0,
      limbicToolCalls: 0,
    });
    return result;
  }

  const blocks = await collectConversationBlocks(conversationIds, range);
  if (blocks.length === 0) {
    const result: LightSleepResult = {
      ok: true,
      day: range.day,
      sessions: 0,
      truncated_sessions: 0,
      tool_calls: 0,
      limbic_tool_calls: 0,
      summary: "No messages in day window; skipping light sleep",
      skipped: "no_day_messages",
    };
    recordLightSleepRun({
      day: range.day,
      conversationIds: [],
      truncatedConversations: 0,
      toolCalls: 0,
      limbicToolCalls: 0,
    });
    return result;
  }

  const activeConversationIds = blocks.map((b) => b.conversationId);
  const dialogue = formatDialogueMessage(blocks);
  const parts = await decomposeSystemPromptParts(opts.selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);

  logComponent("memory").info("light sleep stage 1 (semantic) started", {
    day: range.day,
    sessions: activeConversationIds.length,
    truncated_sessions: dialogue.truncatedConversations,
  });

  const semanticMessages = await buildLightSleepUserMessages(activeConversationIds, blocks);
  const stageSemantic = await runLightSleepEngine({
    systemPrompt,
    userMessages: semanticMessages,
    toolNames: [...LIGHT_SLEEP_TOOL_NAMES],
    stage: "semantic",
  });

  let summary = stageSemantic.summary;

  logComponent("memory").info("light sleep stage 2 (limbic) started", {
    day: range.day,
    semantic_memory_ids: stageSemantic.semantic_memory_ids,
  });

  const limbicMessages = await buildLimbicUserMessages(activeConversationIds, blocks);
  const stageLimbic = await runLightSleepEngine({
    systemPrompt,
    userMessages: limbicMessages,
    toolNames: [...LIMBIC_TOOL_NAMES],
    stage: "limbic",
  });
  summary = appendSummaryPart(summary, "Limbic", stageLimbic.summary);

  const totalToolCalls = stageSemantic.tool_calls + stageLimbic.tool_calls;

  recordLightSleepRun({
    day: range.day,
    conversationIds: activeConversationIds,
    truncatedConversations: dialogue.truncatedConversations,
    toolCalls: stageSemantic.tool_calls,
    limbicToolCalls: stageLimbic.tool_calls,
  });

  const result: LightSleepResult = {
    ok: true,
    day: range.day,
    sessions: activeConversationIds.length,
    truncated_sessions: dialogue.truncatedConversations,
    tool_calls: stageSemantic.tool_calls,
    limbic_tool_calls: stageLimbic.tool_calls,
    summary,
  };

  logComponent("memory").info("light sleep completed", {
    ...result,
    total_tool_calls: totalToolCalls,
  });
  return result;
}
