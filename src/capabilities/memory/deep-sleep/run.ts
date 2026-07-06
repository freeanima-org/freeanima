import { logCapability as logComponent } from "@freeanima/core/config";
import { formatCstIso, omitUndefined } from "@freeanima/core/util";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { runDeepSleepEngine } from "../deep-sleep-port.ts";
import { cstDayRange } from "../light-sleep/build-messages.ts";
import {
  fetchAllActiveMemories,
  buildDeepSleepMessages,
  checkJsonSize,
  DEEP_SLEEP_TOOL_NAMES,
  filterSplitCandidates,
  hasRecentMemoryUpdates,
} from "./build-messages.ts";
import {
  createEmptyChangeLog,
  type DeepSleepRound,
  type DeepSleepResult,
  type DeepSleepMode,
} from "./types.ts";
export type { DeepSleepResult } from "./types.ts";
import { recordDeepSleepRun } from "./state.ts";
import { writeDeepSleepRoundLog, makeRoundLog } from "./log.ts";

export type RunDeepSleepOpts = {
  selfContent: string;
  day?: string;
  /** "full" for manual trigger, "incremental" for scheduled cron (default: "incremental") */
  mode?: DeepSleepMode;
};

const DEEP_SLEEP_ROUNDS: DeepSleepRound[] = [
  "contradiction_expiry",
  "split",
  "merge",
  "pin_maintenance",
];

/**
 * Deep sleep orchestration: four LLM rounds maintain semantic memories.
 *
 * Round order:
 * 1. Contradiction detection + expiry marking
 * 2. Split
 * 3. Deduplicate and merge
 * 4. Pin maintenance
 *
 * Message 1 stays fixed (full active memory JSON); message 1.5 appends change log each round.
 */
export async function runDeepSleep(opts: RunDeepSleepOpts): Promise<DeepSleepResult> {
  const range = cstDayRange(opts.day);
  const day = range.day;
  const mode: DeepSleepMode = opts.mode ?? "incremental";

  // Fetch all active memories
  const allRows = await fetchAllActiveMemories();
  if (allRows.length === 0) {
    const result: DeepSleepResult = {
      ok: true,
      day,
      rounds: [],
      total_tool_calls: 0,
      skipped: "Semantic memory store empty; skipping deep sleep",
    };
    logComponent("memory").info("deep sleep skipped", { day, reason: "no_memories" });
    recordDeepSleepRun({ day, roundsCompleted: 0, stats: { total_tool_calls: 0 } });
    return result;
  }

  // Size check
  const { bytes } = (await import("./build-messages.ts")).formatAllMemoriesMessage(allRows);
  const sizeStatus = checkJsonSize(bytes);
  if (sizeStatus === "error") {
    const result: DeepSleepResult = {
      ok: false,
      day,
      rounds: [],
      total_tool_calls: 0,
      skipped: `Full memory JSON exceeds 300KB (${(bytes / 1024).toFixed(1)}KB); refusing to run`,
    };
    logComponent("memory").error("deep sleep refused", { day, reason: "json_too_large", bytes });
    return result;
  }
  if (sizeStatus === "warn") {
    logComponent("memory").warn("deep sleep full JSON is large", { day, bytes });
  }

  const parts = await decomposeSystemPromptParts(opts.selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);
  const changeLog = createEmptyChangeLog();

  logComponent("memory").info("deep sleep started", {
    day,
    mode,
    active_memories: allRows.length,
    json_bytes: bytes,
    size_status: sizeStatus,
  });

  const roundResults: DeepSleepResult["rounds"] = [];
  let totalToolCalls = 0;
  const roundStats: Record<string, number> = {};

  for (let i = 0; i < DEEP_SLEEP_ROUNDS.length; i++) {
    const round = DEEP_SLEEP_ROUNDS[i];
    if (round === undefined) continue;
    const roundIndex = i + 1;
    const startedAt = formatCstIso();

    // ── Pre-round skip checks ──

    let splitCandidates: ReturnType<typeof filterSplitCandidates> | undefined;

    // Split: pre-filter candidates; skip if none
    if (round === "split") {
      splitCandidates = filterSplitCandidates(allRows, mode);
      if (splitCandidates.length === 0) {
        logComponent("memory").info("deep sleep round skipped (no split candidates)", {
          day,
          round,
          reason: "no_candidates",
        });
        roundResults.push({
          round,
          tool_calls: 0,
          summary: "No split candidates; skipped",
          skipped: "no_candidates",
        });
        continue;
      }
    }

    // Contradiction expiry (incremental): skip if nothing was updated in last 24h
    if (
      round === "contradiction_expiry" &&
      mode === "incremental" &&
      !hasRecentMemoryUpdates(allRows)
    ) {
      logComponent("memory").info("deep sleep round skipped (no recent updates)", {
        day,
        round,
        reason: "no_recent_updates",
      });
      roundResults.push({
        round,
        tool_calls: 0,
        summary: "No recent updates; skipping contradiction check",
        skipped: "no_recent_updates",
      });
      continue;
    }

    // Merge (incremental): skip if nothing updated in 24h (includes deprecations)
    if (round === "merge" && mode === "incremental" && !hasRecentMemoryUpdates(allRows)) {
      logComponent("memory").info("deep sleep round skipped (no recent updates)", {
        day,
        round,
        reason: "no_recent_updates",
      });
      roundResults.push({
        round,
        tool_calls: 0,
        summary: "No recent updates; skipping merge",
        skipped: "no_recent_updates",
      });
      continue;
    }

    // ── Run the round ──

    const roundRows = round === "split" ? splitCandidates : allRows;
    if (!roundRows) throw new Error("deep sleep split round missing splitCandidates");

    const messages = buildDeepSleepMessages(
      roundRows,
      round,
      changeLog,
      omitUndefined({
        splitTotalActive: round === "split" ? allRows.length : undefined,
      }),
    );

    const engineResult = await runDeepSleepEngine({
      systemPrompt,
      userMessages: [
        messages.allMemoriesText,
        messages.changeLogText,
        messages.preScreenText,
        messages.instructionText,
      ],
      toolNames: [...DEEP_SLEEP_TOOL_NAMES],
      changeLog,
    });

    const finishedAt = formatCstIso();
    totalToolCalls += engineResult.tool_calls;
    roundStats[round] = engineResult.tool_calls;

    // Write operation log
    const roundLog = makeRoundLog({
      day,
      round,
      roundIndex,
      startedAt,
      finishedAt,
      activeMemoryCount: allRows.length,
      changeLogBefore: changeLog, // snapshot (by reference)
      toolCalls: engineResult.tool_calls,
      summary: engineResult.summary,
      changeLogAfter: changeLog,
    });
    writeDeepSleepRoundLog(roundLog);

    roundResults.push({
      round,
      tool_calls: engineResult.tool_calls,
      summary: engineResult.summary,
    });

    logComponent("memory").info("deep sleep round completed", {
      day,
      round,
      round_index: roundIndex,
      tool_calls: engineResult.tool_calls,
    });
  }

  const roundsExecuted = roundResults.filter((r) => !r.skipped).length;
  const roundsSkipped = roundResults.length - roundsExecuted;

  recordDeepSleepRun({
    day,
    roundsCompleted: roundsExecuted,
    stats: omitUndefined({
      total_tool_calls: totalToolCalls,
      rounds_skipped: roundsSkipped,
      contradiction_expiry_calls: roundStats["contradiction_expiry"],
      split_calls: roundStats["split"],
      merge_calls: roundStats["merge"],
      pin_maintenance_calls: roundStats["pin_maintenance"],
    }),
  });

  const result: DeepSleepResult = {
    ok: true,
    day,
    rounds: roundResults,
    total_tool_calls: totalToolCalls,
  };

  logComponent("memory").info("deep sleep completed", result);
  return result;
}
