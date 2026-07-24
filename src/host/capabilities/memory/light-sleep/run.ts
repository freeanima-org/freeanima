import { logCapability as logComponent } from "@freeanima/host/core/config";
import { listConversationIdsUpdatedBetween } from "@freeanima/host/core/db/pg/conversation";
import { listActiveAutobiographicalMemory } from "@freeanima/host/core/db/pg/autobiographical-memory";

import { buildLightSleepAutobiographyUserMessages } from "../autobiography/build-messages.ts";
import { runAutobiographyEngine } from "../autobiography-port.ts";
import { refreshAutobiographySummaryBlock } from "../autobiography/run.ts";
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
  autobiography_tool_calls: number;
  narratives_created: number;
  summary_refreshed: boolean;
  summary: string;
  skipped?: string;
};

export type RunLightSleepOpts = {
  selfContent: string;
  day?: string;
  skipSummaryRefresh?: boolean;
};

const LIGHT_SLEEP_TOOL_NAMES = [
  "memory_semantic_create",
  "memory_semantic_update",
  "memory_semantic_deprecate",
] as const;

const LIMBIC_TOOL_NAMES = ["memory_limbic_create"] as const;

const AUTOBIOGRAPHY_TOOL_NAMES = [
  "memory_autobiographical_create",
  "memory_autobiographical_deprecate",
] as const;

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
      autobiography_tool_calls: 0,
      narratives_created: 0,
      summary_refreshed: false,
      summary: "No conversation activity today; skipping light sleep",
      skipped: "no_sessions",
    };
    recordLightSleepRun({
      day: range.day,
      conversationIds: [],
      truncatedConversations: 0,
      toolCalls: 0,
      limbicToolCalls: 0,
      autobiographyToolCalls: 0,
      narrativesCreated: 0,
      summaryRefreshed: false,
    });
    return result;
  }

  const blocks = await collectConversationBlocks(conversationIds);
  const dialogue = formatDialogueMessage(blocks);
  const parts = await decomposeSystemPromptParts(opts.selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);

  logComponent("memory").info("light sleep stage 1 (semantic) started", {
    day: range.day,
    sessions: conversationIds.length,
    truncated_sessions: dialogue.truncatedConversations,
  });

  const semanticMessages = await buildLightSleepUserMessages(conversationIds, blocks);
  const stageSemantic = await runLightSleepEngine({
    systemPrompt,
    userMessages: semanticMessages,
    toolNames: [...LIGHT_SLEEP_TOOL_NAMES],
  });

  let summary = stageSemantic.summary;

  logComponent("memory").info("light sleep stage 2 (limbic) started", {
    day: range.day,
    semantic_memory_ids: stageSemantic.semantic_memory_ids,
  });

  const limbicMessages = await buildLimbicUserMessages(conversationIds, blocks);
  const stageLimbic = await runLightSleepEngine({
    systemPrompt,
    userMessages: limbicMessages,
    toolNames: [...LIMBIC_TOOL_NAMES],
  });
  summary = appendSummaryPart(summary, "Limbic", stageLimbic.summary);

  logComponent("memory").info("light sleep stage 3 (autobiographical) started", {
    day: range.day,
    limbic_memory_ids: stageLimbic.limbic_memory_ids,
  });

  const existingAuto = await listActiveAutobiographicalMemory({ limit: 200 });
  const autobiographyMessages = await buildLightSleepAutobiographyUserMessages(
    conversationIds,
    stageSemantic.semantic_memory_ids,
    stageLimbic.limbic_memory_ids,
    blocks,
  );
  const stageAutobiography = await runAutobiographyEngine({
    systemPrompt,
    userMessages: autobiographyMessages,
    toolNames: [...AUTOBIOGRAPHY_TOOL_NAMES],
  });
  summary = appendSummaryPart(summary, "Autobiography", stageAutobiography.summary);

  const afterAuto = await listActiveAutobiographicalMemory({ limit: 200 });
  const narrativesCreated = Math.max(0, afterAuto.length - existingAuto.length);

  let summaryRefreshed = false;
  if (!opts.skipSummaryRefresh) {
    summaryRefreshed = await refreshAutobiographySummaryBlock();
    logComponent("memory").info("light sleep stage 3b (autobiography summary) completed", {
      day: range.day,
      summary_refreshed: summaryRefreshed,
    });
  } else {
    logComponent("memory").info("light sleep stage 3b skipped", {
      day: range.day,
      reason: "skip_summary_refresh",
    });
  }

  const totalToolCalls =
    stageSemantic.tool_calls + stageLimbic.tool_calls + stageAutobiography.tool_calls;

  recordLightSleepRun({
    day: range.day,
    conversationIds,
    truncatedConversations: dialogue.truncatedConversations,
    toolCalls: stageSemantic.tool_calls,
    limbicToolCalls: stageLimbic.tool_calls,
    autobiographyToolCalls: stageAutobiography.tool_calls,
    narrativesCreated,
    summaryRefreshed,
  });

  const result: LightSleepResult = {
    ok: true,
    day: range.day,
    sessions: conversationIds.length,
    truncated_sessions: dialogue.truncatedConversations,
    tool_calls: stageSemantic.tool_calls,
    limbic_tool_calls: stageLimbic.tool_calls,
    autobiography_tool_calls: stageAutobiography.tool_calls,
    narratives_created: narrativesCreated,
    summary_refreshed: summaryRefreshed,
    summary,
  };

  logComponent("memory").info("light sleep completed", {
    ...result,
    total_tool_calls: totalToolCalls,
  });
  return result;
}
