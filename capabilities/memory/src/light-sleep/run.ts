import { logCapability as logComponent } from "@freeanima/core/config";
import type {
  AutobiographicalMemoryStorePort,
  SelfLayerStorePort,
  SemanticMemoryStorePort,
  SessionStorePort,
} from "@freeanima/core/repos";

import { buildLightSleepAutobiographyUserMessages } from "../autobiography/build-messages.ts";
import { runAutobiographyEngine } from "../autobiography-port.ts";
import { refreshAutobiographySummaryBlock } from "../autobiography/run.ts";
import { getAutobiographicalMemoryStore } from "../autobiographical-port.ts";
import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { getMemorySessionStore } from "../session-port.ts";
import {
  buildLightSleepUserMessages,
  buildLimbicUserMessages,
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
  limbic_tool_calls: number;
  autobiography_tool_calls: number;
  narratives_created: number;
  summary_refreshed: boolean;
  summary: string;
  skipped?: string;
};

export type RunLightSleepOpts = {
  sessionStore?: SessionStorePort;
  semanticStore?: SemanticMemoryStorePort;
  autoStore?: AutobiographicalMemoryStorePort;
  selfStore?: SelfLayerStorePort;
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
  const sessionStore = opts.sessionStore ?? getMemorySessionStore();
  const autoStore = opts.autoStore ?? getAutobiographicalMemoryStore();
  const range = cstDayRange(opts.day);
  const sessionIds = await sessionStore.listSessionIdsUpdatedBetween(range.fromIso, range.toIso);

  if (!sessionIds.length) {
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
      summary: "No session activity today; skipping light sleep",
      skipped: "no_sessions",
    };
    recordLightSleepRun({
      day: range.day,
      sessionIds: [],
      truncatedSessions: 0,
      toolCalls: 0,
      limbicToolCalls: 0,
      autobiographyToolCalls: 0,
      narrativesCreated: 0,
      summaryRefreshed: false,
    });
    return result;
  }

  const blocks = await collectSessionBlocks(sessionStore, sessionIds);
  const dialogue = formatDialogueMessage(blocks);
  const parts = await decomposeSystemPromptParts(opts.selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);

  logComponent("memory").info("light sleep stage 1 (semantic) started", {
    day: range.day,
    sessions: sessionIds.length,
    truncated_sessions: dialogue.truncatedSessions,
  });

  const semanticMessages = await buildLightSleepUserMessages(sessionStore, sessionIds);
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

  const limbicMessages = await buildLimbicUserMessages(sessionStore, sessionIds);
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

  const existingAuto = await autoStore.listActive({ limit: 200 });
  const autobiographyMessages = await buildLightSleepAutobiographyUserMessages(
    sessionStore,
    sessionIds,
    stageSemantic.semantic_memory_ids,
    stageLimbic.limbic_memory_ids,
  );
  const stageAutobiography = await runAutobiographyEngine({
    systemPrompt,
    userMessages: autobiographyMessages,
    toolNames: [...AUTOBIOGRAPHY_TOOL_NAMES],
  });
  summary = appendSummaryPart(summary, "Autobiography", stageAutobiography.summary);

  const afterAuto = await autoStore.listActive({ limit: 200 });
  const narrativesCreated = Math.max(0, afterAuto.length - existingAuto.length);

  let summaryRefreshed = false;
  if (opts.selfStore && !opts.skipSummaryRefresh) {
    summaryRefreshed = await refreshAutobiographySummaryBlock(autoStore, opts.selfStore);
    logComponent("memory").info("light sleep stage 3b (autobiography summary) completed", {
      day: range.day,
      summary_refreshed: summaryRefreshed,
    });
  } else if (opts.skipSummaryRefresh) {
    logComponent("memory").info("light sleep stage 3b skipped", {
      day: range.day,
      reason: "skip_summary_refresh",
    });
  } else {
    logComponent("memory").warn("light sleep stage 3b skipped: selfStore not injected", {
      day: range.day,
    });
  }

  const totalToolCalls =
    stageSemantic.tool_calls + stageLimbic.tool_calls + stageAutobiography.tool_calls;

  recordLightSleepRun({
    day: range.day,
    sessionIds,
    truncatedSessions: dialogue.truncatedSessions,
    toolCalls: stageSemantic.tool_calls,
    limbicToolCalls: stageLimbic.tool_calls,
    autobiographyToolCalls: stageAutobiography.tool_calls,
    narrativesCreated,
    summaryRefreshed,
  });

  const result: LightSleepResult = {
    ok: true,
    day: range.day,
    sessions: sessionIds.length,
    truncated_sessions: dialogue.truncatedSessions,
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
