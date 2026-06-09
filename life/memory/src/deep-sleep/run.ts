import { logComponent } from "@freeanima/service-logging";
import { formatCstIso } from "@freeanima/kernel-util";

import { composeSystemPrompt, decomposeSystemPromptParts } from "../system-prompt.ts";
import { runDeepSleepEngine } from "../deep-sleep-port.ts";
import { cstDayRange } from "../light-sleep/build-messages.ts";
import {
  fetchAllActiveMemories,
  buildDeepSleepMessages,
  checkJsonSize,
  DEEP_SLEEP_TOOL_NAMES,
} from "./build-messages.ts";
import { createEmptyChangeLog, type DeepSleepRound, type DeepSleepResult } from "./types.ts";
export type { DeepSleepResult } from "./types.ts";
import { recordDeepSleepRun } from "./state.ts";
import { writeDeepSleepRoundLog, makeRoundLog } from "./log.ts";

export type RunDeepSleepOpts = {
  selfContent: string;
  day?: string;
};

const DEEP_SLEEP_ROUNDS: DeepSleepRound[] = ["contradiction_expiry", "split", "merge"];

/**
 * 深睡编排：三轮 LLM 调用处理语义记忆的维护操作。
 *
 * 三轮顺序：
 * 1. 矛盾检测 + 过期标记
 * 2. 拆分
 * 3. 去重合并
 *
 * 消息1 始终不变（全量 active 记忆 JSON），消息1.5 随轮追加变更日志。
 */
export async function runDeepSleep(opts: RunDeepSleepOpts): Promise<DeepSleepResult> {
  const range = cstDayRange(opts.day);
  const day = range.day;

  // 获取全量 active 记忆
  const allRows = await fetchAllActiveMemories();
  if (allRows.length === 0) {
    const result: DeepSleepResult = {
      ok: true,
      day,
      rounds: [],
      total_tool_calls: 0,
      skipped: "语义记忆库为空，跳过深睡",
    };
    logComponent("memory").info("深睡跳过", { day, reason: "no_memories" });
    recordDeepSleepRun({ day, roundsCompleted: 0, stats: { total_tool_calls: 0 } });
    return result;
  }

  // 大小检查
  const { bytes } = (await import("./build-messages.ts")).formatAllMemoriesMessage(allRows);
  const sizeStatus = checkJsonSize(bytes);
  if (sizeStatus === "error") {
    const result: DeepSleepResult = {
      ok: false,
      day,
      rounds: [],
      total_tool_calls: 0,
      skipped: `全量记忆 JSON 超过 300KB（${(bytes / 1024).toFixed(1)}KB），拒绝执行`,
    };
    logComponent("memory").error("深睡拒绝", { day, reason: "json_too_large", bytes });
    return result;
  }
  if (sizeStatus === "warn") {
    logComponent("memory").warn("深睡全量 JSON 较大", { day, bytes });
  }

  const parts = await decomposeSystemPromptParts(opts.selfContent, null);
  const systemPrompt = composeSystemPrompt(parts);
  const changeLog = createEmptyChangeLog();

  logComponent("memory").info("深睡开始", {
    day,
    active_memories: allRows.length,
    json_bytes: bytes,
    size_status: sizeStatus,
  });

  const roundResults: DeepSleepResult["rounds"] = [];
  let totalToolCalls = 0;
  const roundStats: Record<string, number> = {};

  for (let i = 0; i < DEEP_SLEEP_ROUNDS.length; i++) {
    const round = DEEP_SLEEP_ROUNDS[i];
    const roundIndex = i + 1;
    const startedAt = formatCstIso();

    const messages = buildDeepSleepMessages(allRows, round, changeLog);

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

    // 写操作日志
    const roundLog = makeRoundLog({
      day,
      round,
      roundIndex,
      startedAt,
      finishedAt,
      activeMemoryCount: allRows.length,
      changeLogBefore: changeLog, // 快照（引用）
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

    logComponent("memory").info("深睡轮次完成", {
      day,
      round,
      round_index: roundIndex,
      tool_calls: engineResult.tool_calls,
    });
  }

  recordDeepSleepRun({
    day,
    roundsCompleted: DEEP_SLEEP_ROUNDS.length,
    stats: {
      total_tool_calls: totalToolCalls,
      contradiction_expiry_calls: roundStats["contradiction_expiry"],
      split_calls: roundStats["split"],
      merge_calls: roundStats["merge"],
    },
  });

  const result: DeepSleepResult = {
    ok: true,
    day,
    rounds: roundResults,
    total_tool_calls: totalToolCalls,
  };

  logComponent("memory").info("深睡完成", result);
  return result;
}
