/**
 * 内建 reflect：按 search_documents.cluster_id 分批巩固；每批并入跨族近邻。
 * NULL / 超字节再切块。结束后若全局 pin 超限再精简。
 */

import { getActiveRuntimeConfig } from "@freeanima/habitat/core/config";
import {
  resolveMemoryClusteringConfig,
  resolveMemoryResidentConfig,
} from "@freeanima/habitat/core/config/schemas/memory-config.ts";
import { logCapability as logComponent } from "@freeanima/habitat/core/config/capability-injection";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";
import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { omitUndefined } from "@freeanima/habitat/core/util";
import {
  listActiveSemanticMemoryClusterIds,
  listActiveSemanticMemoryEmbeddings,
} from "@freeanima/habitat/core/db/pg/search/clustering-repo.ts";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import { cstDayRange } from "../day-window/build-messages.ts";
import {
  fetchAllActiveMemories,
  checkJsonSize,
  DEEP_SLEEP_TOOL_NAMES,
  DEEP_SLEEP_PIN_TOOL_NAMES,
  REFLECT_CONSOLIDATE_TASK_SPEC,
  REFLECT_CONSOLIDATE_PIN_TASK_SPEC,
  hasRecentMemoryUpdates,
  shouldTrimPinned,
  formatAllMemoriesMessage,
} from "../reflect/build-messages.ts";
import {
  createEmptyChangeLog,
  snapshotChangeLog,
  type DeepSleepMode,
  type DeepSleepChangeLog,
} from "../reflect/types.ts";
import { recordDeepSleepRun } from "../reflect/state.ts";
import { isReflectLlmRegistered, runReflectLlm } from "./reflect-llm-port.ts";
import type { ReflectEngineResult } from "./reflect.ts";
import {
  expandClusterBatchWithNeighbors,
  filterDeprecatedBatchRows,
  partitionRowsByCluster,
  type NeighborEmbedding,
} from "../clustering/batch.ts";

export type BuiltinReflectInput = {
  conversation_ids?: string[];
  force?: boolean;
  day?: string;
  /** @deprecated 忽略；reflect 不再注入自我层 / 常驻 */
  selfContent?: string;
  /** force → full；否则 incremental（对齐原定时深睡） */
  mode?: DeepSleepMode;
};

function shouldConsolidateBatch(batchRows: SemanticMemoryRow[], mode: DeepSleepMode): boolean {
  return mode === "full" || hasRecentMemoryUpdates(batchRows);
}

async function runConsolidateBatch(opts: {
  batchRows: SemanticMemoryRow[];
  changeLog: DeepSleepChangeLog;
}): Promise<{ roundsExecuted: number; toolCalls: number }> {
  const { batchRows, changeLog } = opts;
  const { text } = formatAllMemoriesMessage(batchRows);

  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "memory-reflect",
    taskSpec: REFLECT_CONSOLIDATE_TASK_SPEC,
    dataParts: [
      {
        tag: PROMPT_XML_TAGS.semanticMemories,
        body: text,
        attrs: { count: String(batchRows.length) },
      },
    ],
  });

  const llm = await runReflectLlm({
    systemPrompt,
    userMessages,
    toolNames: [...DEEP_SLEEP_TOOL_NAMES],
    round: "consolidate",
    changeLog,
  });
  void snapshotChangeLog(changeLog);

  return { roundsExecuted: 1, toolCalls: llm.tool_calls };
}

async function runPinTrimBatch(opts: {
  batchRows: SemanticMemoryRow[];
  pinnedCount: number;
  pinnedMax: number;
  changeLog: DeepSleepChangeLog;
}): Promise<{ roundsExecuted: number; toolCalls: number }> {
  const { batchRows, pinnedCount, pinnedMax, changeLog } = opts;
  if (batchRows.length === 0) {
    return { roundsExecuted: 0, toolCalls: 0 };
  }

  const { text } = formatAllMemoriesMessage(batchRows);

  const { systemPrompt, userMessages } = composeAutoLlmPrompt({
    kind: "memory-reflect",
    taskSpec: REFLECT_CONSOLIDATE_PIN_TASK_SPEC,
    taskParams: { pinned_count: pinnedCount, pinned_max: pinnedMax },
    dataParts: [
      {
        tag: PROMPT_XML_TAGS.semanticMemories,
        body: text,
        attrs: { count: String(batchRows.length) },
      },
    ],
  });

  const llm = await runReflectLlm({
    systemPrompt,
    userMessages,
    toolNames: [...DEEP_SLEEP_PIN_TOOL_NAMES],
    round: "consolidate_pin",
    changeLog,
  });
  void snapshotChangeLog(changeLog);

  return { roundsExecuted: 1, toolCalls: llm.tool_calls };
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

  const runtimeData = getActiveRuntimeConfig().data;
  const clustering = resolveMemoryClusteringConfig(runtimeData);
  const { pinned_max: pinnedMax } = resolveMemoryResidentConfig(runtimeData);
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
  let embeddings: NeighborEmbedding[] | undefined;

  for (let bi = 0; bi < batches.length; bi++) {
    const batch = batches[bi];
    if (!batch || batch.rows.length === 0) continue;
    // incremental：只看本族原行；近邻 updated_at 不唤醒死族
    if (!shouldConsolidateBatch(batch.rows, mode)) continue;

    let working = batch;
    if (batch.clusterId != null) {
      if (!embeddings) {
        embeddings = await listActiveSemanticMemoryEmbeddings();
      }
      working = expandClusterBatchWithNeighbors(batch, allRows, embeddings, {
        eps: clustering.eps,
        maxBatchBytes: clustering.max_batch_bytes,
      });
    }
    const batchRows = filterDeprecatedBatchRows(working.rows, changeLog.deprecatedIds);
    if (batchRows.length === 0) continue;

    logComponent("memory").info("reflect batch", {
      day,
      batchIndex: bi,
      batchCount: batches.length,
      clusterId: batch.clusterId,
      rows: batchRows.length,
      neighbors: Math.max(0, working.rows.length - batch.rows.length),
      bytes: working.bytes,
      round: "consolidate",
    });
    const result = await runConsolidateBatch({
      batchRows,
      changeLog,
    });
    roundsExecuted += result.roundsExecuted;
    totalToolCalls += result.toolCalls;
  }

  // 全局 pin 超限 → 精简（与簇巩固分离；只 unpin）
  const pinnedRows = allRows.filter((r) => r.pinned);
  const pinnedCount = pinnedRows.length;
  if (shouldTrimPinned(pinnedCount, pinnedMax)) {
    const pinBatches = partitionRowsByCluster(
      pinnedRows,
      new Map(pinnedRows.map((r) => [r.id, null])),
      clustering.max_batch_bytes,
    );
    logComponent("memory").info("reflect pin trim", {
      day,
      pinnedCount,
      pinnedMax,
      batches: pinBatches.length,
    });
    for (let pi = 0; pi < pinBatches.length; pi++) {
      const pinBatch = pinBatches[pi];
      if (!pinBatch || pinBatch.rows.length === 0) continue;
      const result = await runPinTrimBatch({
        batchRows: pinBatch.rows,
        pinnedCount,
        pinnedMax,
        changeLog,
      });
      roundsExecuted += result.roundsExecuted;
      totalToolCalls += result.toolCalls;
    }
  }

  recordDeepSleepRun({
    day,
    roundsCompleted: roundsExecuted,
    stats: omitUndefined({
      total_tool_calls: totalToolCalls,
      consolidate_calls: roundsExecuted,
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
    pinnedCount,
    pinnedMax,
  });

  return {
    merged,
    deprecated,
    conflicts,
    summary: `reflect ${mode} batches=${batches.length} rounds=${roundsExecuted} tools=${totalToolCalls}`,
  };
}
