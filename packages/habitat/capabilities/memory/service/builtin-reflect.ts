/**
 * 内建 reflect：深睡四轮巩固迁入 MemoryService（#16102）。
 * 按 search_documents.cluster_id 分批；NULL / 超字节再切块。
 */

import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import { resolveMemoryClusteringConfig } from "@freeanima/habitat/core/config/schemas/memory-config.ts";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { omitUndefined } from "@freeanima/habitat/core/util";
import { listActiveSemanticMemoryClusterIds } from "@freeanima/habitat/core/db/pg/search/clustering-repo.ts";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import { cstDayRange } from "../day-window/build-messages.ts";
import {
  fetchAllActiveMemories,
  buildDeepSleepMessages,
  checkJsonSize,
  DEEP_SLEEP_TOOL_NAMES,
  REFLECT_TASK_SPEC,
  filterSplitCandidates,
  hasRecentMemoryUpdates,
  formatAllMemoriesMessage,
} from "../reflect/build-messages.ts";
import {
  createEmptyChangeLog,
  snapshotChangeLog,
  type DeepSleepRound,
  type DeepSleepMode,
  type DeepSleepChangeLog,
} from "../reflect/types.ts";
import { recordDeepSleepRun } from "../reflect/state.ts";
import { isReflectLlmRegistered, runReflectLlm } from "./reflect-llm-port.ts";
import type { ReflectEngineResult } from "./reflect.ts";
import { partitionRowsByCluster } from "../clustering/batch.ts";

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
  /** @deprecated 忽略；reflect 不再注入自我层 / 常驻 */
  selfContent?: string;
  /** force → full；否则 incremental（对齐原定时深睡） */
  mode?: DeepSleepMode;
};

async function runReflectRoundsOnBatch(opts: {
  batchRows: SemanticMemoryRow[];
  mode: DeepSleepMode;
  changeLog: DeepSleepChangeLog;
}): Promise<{ roundsExecuted: number; toolCalls: number }> {
  const { batchRows, mode, changeLog } = opts;
  let roundsExecuted = 0;
  let toolCalls = 0;

  for (let i = 0; i < REFLECT_ROUNDS.length; i++) {
    const round = REFLECT_ROUNDS[i];
    if (round === undefined) continue;

    let splitCandidates: ReturnType<typeof filterSplitCandidates> | undefined;
    if (round === "split") {
      splitCandidates = filterSplitCandidates(batchRows, mode);
      if (splitCandidates.length === 0) continue;
    }
    if (
      round === "contradiction_expiry" &&
      mode === "incremental" &&
      !hasRecentMemoryUpdates(batchRows)
    ) {
      continue;
    }
    if (round === "merge" && mode === "incremental" && !hasRecentMemoryUpdates(batchRows)) {
      continue;
    }

    const roundRows = round === "split" ? splitCandidates : batchRows;
    if (!roundRows) continue;

    const messages = buildDeepSleepMessages(
      roundRows,
      round,
      changeLog,
      omitUndefined({
        splitTotalActive: round === "split" ? batchRows.length : undefined,
      }),
    );

    const { systemPrompt, userMessages } = composeAutoLlmPrompt({
      kind: "memory-reflect",
      taskSpec: REFLECT_TASK_SPEC,
      dataParts: [
        { body: messages.allMemoriesText },
        { body: messages.changeLogText },
        { body: messages.preScreenText },
        { body: messages.instructionText },
      ],
    });

    const llm = await runReflectLlm({
      systemPrompt,
      userMessages,
      toolNames: [...DEEP_SLEEP_TOOL_NAMES],
      round,
      changeLog,
    });
    toolCalls += llm.tool_calls;
    roundsExecuted += 1;
    void snapshotChangeLog(changeLog);
  }

  return { roundsExecuted, toolCalls };
}

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
  void input.selfContent;

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

  const clustering = resolveMemoryClusteringConfig(getActiveRuntimeConfig().data);
  const clusterRows = await listActiveSemanticMemoryClusterIds();
  const clusterById = new Map<number, number | null>();
  for (const row of clusterRows) {
    clusterById.set(row.entityId, row.clusterId);
  }

  let batches = partitionRowsByCluster(allRows, clusterById, clustering.max_batch_bytes);

  // 无簇信息时退化为按字节切全量（避免整库 300KB 一刀切）
  if (batches.length === 1 && batches[0] && checkJsonSize(batches[0].bytes) === "error") {
    batches = partitionRowsByCluster(
      allRows,
      new Map(allRows.map((r) => [r.id, null])),
      clustering.max_batch_bytes,
    );
  }

  // 兼容：若仍是单批且体积仅 warn，继续；error 级单条超大仍尝试跑（已无法再切）
  const { bytes: totalBytes } = formatAllMemoriesMessage(allRows);
  if (batches.length === 1) {
    const sizeStatus = checkJsonSize(batches[0]?.bytes ?? totalBytes);
    if (sizeStatus === "error" && (batches[0]?.rows.length ?? 0) > 1) {
      logComponent("memory").error("reflect refused", {
        day,
        reason: "json_too_large",
        bytes: batches[0]?.bytes,
      });
      return {
        merged: 0,
        deprecated: 0,
        conflicts: 0,
        summary: `json_too_large:${((batches[0]?.bytes ?? 0) / 1024).toFixed(1)}KB`,
      };
    }
  }

  const changeLog = createEmptyChangeLog();
  let totalToolCalls = 0;
  let roundsExecuted = 0;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    if (!batch || batch.rows.length === 0) continue;
    logComponent("memory").info("reflect batch", {
      day,
      batchIndex: bi,
      batchCount: batches.length,
      clusterId: batch.clusterId,
      rows: batch.rows.length,
      bytes: batch.bytes,
    });
    const result = await runReflectRoundsOnBatch({
      batchRows: batch.rows,
      mode,
      changeLog,
    });
    roundsExecuted += result.roundsExecuted;
    totalToolCalls += result.toolCalls;
  }

  recordDeepSleepRun({
    day,
    roundsCompleted: roundsExecuted,
    stats: omitUndefined({
      total_tool_calls: totalToolCalls,
    }),
  });

  const merged = changeLog.addedIds.length;
  const deprecated = changeLog.deprecatedIds.length;
  const conflicts = changeLog.modifiedIds.length;

  logComponent("memory").info("builtin reflect completed", {
    day,
    mode,
    batches: batches.length,
    roundsExecuted,
    totalToolCalls,
    merged,
    deprecated,
    conflicts,
  });

  return {
    merged,
    deprecated,
    conflicts,
    summary: `reflect ${mode} batches=${batches.length} rounds=${roundsExecuted} tools=${totalToolCalls}`,
  };
}
