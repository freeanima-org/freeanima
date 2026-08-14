/**
 * 内建 reflect：深睡四轮巩固迁入 MemoryService（#16102）。
 */

import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { loadSelfLayerPrompt } from "@freeanima/habitat/capabilities/self";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { cstDayRange } from "../day-window/build-messages.ts";
import {
  fetchAllActiveMemories,
  buildDeepSleepMessages,
  checkJsonSize,
  DEEP_SLEEP_TOOL_NAMES,
  filterSplitCandidates,
  hasRecentMemoryUpdates,
  formatAllMemoriesMessage,
} from "../reflect/build-messages.ts";
import {
  createEmptyChangeLog,
  snapshotChangeLog,
  type DeepSleepRound,
  type DeepSleepMode,
} from "../reflect/types.ts";
import { recordDeepSleepRun } from "../reflect/state.ts";
import { isReflectLlmRegistered, runReflectLlm } from "./reflect-llm-port.ts";
import type { ReflectEngineResult } from "./reflect.ts";

const REFLECT_ROUNDS: DeepSleepRound[] = [
  "contradiction_expiry",
  "split",
  "merge",
  "pin_maintenance",
];

export type BuiltinReflectInput = {
  conversation_ids?: string[];
  force?: boolean;
  day?: string;
  selfContent?: string;
  /** force → full；否则 incremental（对齐原定时深睡） */
  mode?: DeepSleepMode;
};

export async function runBuiltinReflect(
  input: BuiltinReflectInput = {},
): Promise<ReflectEngineResult> {
  if (!isReflectLlmRegistered()) {
    logComponent("memory").debug("reflect LLM not registered; skip");
    return {
      merged: 0,
      deprecated: 0,
      conflicts: 0,
      summary: "reflect_llm_unregistered",
    };
  }

  const range = cstDayRange(input.day);
  const day = range.day;
  const mode: DeepSleepMode = input.mode ?? (input.force ? "full" : "incremental");
  const selfContent = input.selfContent ?? (await loadSelfLayerPrompt());

  const allRows = await fetchAllActiveMemories();
  if (allRows.length === 0) {
    recordDeepSleepRun({ day, roundsCompleted: 0, stats: { total_tool_calls: 0 } });
    return {
      merged: 0,
      deprecated: 0,
      conflicts: 0,
      summary: "empty_store",
    };
  }

  const { bytes } = formatAllMemoriesMessage(allRows);
  const sizeStatus = checkJsonSize(bytes);
  if (sizeStatus === "error") {
    logComponent("memory").error("reflect refused", { day, reason: "json_too_large", bytes });
    return {
      merged: 0,
      deprecated: 0,
      conflicts: 0,
      summary: `json_too_large:${(bytes / 1024).toFixed(1)}KB`,
    };
  }

  const parts = await decomposeSystemPromptParts(selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);
  const changeLog = createEmptyChangeLog();
  let totalToolCalls = 0;
  let roundsExecuted = 0;

  for (let i = 0; i < REFLECT_ROUNDS.length; i++) {
    const round = REFLECT_ROUNDS[i];
    if (round === undefined) continue;

    let splitCandidates: ReturnType<typeof filterSplitCandidates> | undefined;
    if (round === "split") {
      splitCandidates = filterSplitCandidates(allRows, mode);
      if (splitCandidates.length === 0) continue;
    }
    if (
      round === "contradiction_expiry" &&
      mode === "incremental" &&
      !hasRecentMemoryUpdates(allRows)
    ) {
      continue;
    }
    if (round === "merge" && mode === "incremental" && !hasRecentMemoryUpdates(allRows)) {
      continue;
    }

    const roundRows = round === "split" ? splitCandidates : allRows;
    if (!roundRows) continue;

    const messages = buildDeepSleepMessages(
      roundRows,
      round,
      changeLog,
      omitUndefined({
        splitTotalActive: round === "split" ? allRows.length : undefined,
      }),
    );

    const llm = await runReflectLlm({
      systemPrompt,
      userMessages: [
        messages.allMemoriesText,
        messages.changeLogText,
        messages.preScreenText,
        messages.instructionText,
      ],
      toolNames: [...DEEP_SLEEP_TOOL_NAMES],
      round,
      changeLog,
    });
    totalToolCalls += llm.tool_calls;
    roundsExecuted += 1;
    void snapshotChangeLog(changeLog);
  }

  recordDeepSleepRun({
    day,
    roundsCompleted: roundsExecuted,
    stats: omitUndefined({ total_tool_calls: totalToolCalls }),
  });

  const merged = changeLog.addedIds.length;
  const deprecated = changeLog.deprecatedIds.length;
  const conflicts = changeLog.modifiedIds.length;

  logComponent("memory").info("builtin reflect completed", {
    day,
    mode,
    roundsExecuted,
    totalToolCalls,
    merged,
    deprecated,
  });

  return {
    merged,
    deprecated,
    conflicts,
    summary: `reflect:${mode}:rounds=${roundsExecuted}:tools=${totalToolCalls}`,
  };
}
