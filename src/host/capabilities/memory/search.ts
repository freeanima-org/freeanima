import type { MessageFtsHit } from "@freeanima/host/core/db/pg/conversation/types";
import { omitUndefined } from "@freeanima/host/core/util";
import { searchSemanticMemoryFts } from "@freeanima/host/core/db/pg/semantic-memory";
import { searchMessagesFts } from "@freeanima/host/core/db/pg/conversation";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/host/core/soft-failure";

export type SearchResult = {
  content: string;
  source: "semantic_memory" | "dialogue";
  path: string;
  score: number;
  metadata: Record<string, unknown>;
};

const DEFAULT_LIMIT = 10;

function notifyMemorySearchSoftFailure(kind: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void notifySoftFailure({
    sourceRef: cstDaySourceRef(`memory:search_failed:${kind}`),
    title: "记忆检索失败（已返回空结果）",
    body: [
      `记忆检索通道「${kind}」出错，本轮已按空结果继续，避免阻断对话。`,
      `错误：${message}`,
      "若反复出现，请检查 PG FTS / 分词 / 索引是否健康。",
    ].join("\n"),
    payload: { kind: "memory_search_failed", channel: kind, error: message },
    logLabel: "memory_search",
  });
}

/** PG ts_rank_cd (positive; higher means more relevant) */
function pgRankToScore(rank: number): number {
  return Math.min(1.0, Math.max(0.1, rank * 5.0));
}

async function searchSemanticMemoryInternal(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  const rows = await searchSemanticMemoryFts(query, { limit });
  return rows.map((r) => ({
    content: r.content,
    source: "semantic_memory" as const,
    path: `pg:semantic_memory:${r.id}`,
    score: pgRankToScore(r.rank),
    metadata: {
      id: r.id,
      type: r.type,
      pinned: r.pinned,
    },
  }));
}

async function searchDialogueInternal(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  try {
    const rows = await searchDialogue(query, { limit });
    return rows.map((row) => ({
      content: row.content,
      source: "dialogue" as const,
      path: `pg:messages:${row.conversation_id}`,
      score: pgRankToScore(row.rank),
      metadata: {
        role: row.role,
        conversation_id: row.conversation_id,
        timestamp: row.timestamp,
      },
    }));
  } catch (e) {
    notifyMemorySearchSoftFailure("dialogue", e);
    return [];
  }
}

export async function search(query: string, limit = DEFAULT_LIMIT): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    results.push(...(await searchSemanticMemoryInternal(query, limit)));
  } catch (e) {
    notifyMemorySearchSoftFailure("semantic", e);
  }
  try {
    results.push(...(await searchDialogueInternal(query, limit)));
  } catch (e) {
    notifyMemorySearchSoftFailure("dialogue", e);
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export async function searchSemanticMemory(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  const results = await searchSemanticMemoryInternal(query, limit);
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export async function searchDialogue(
  query: string,
  opts?: { conversationId?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  return searchMessagesFts(
    query,
    omitUndefined({
      conversation_id: opts?.conversationId,
      limit: opts?.limit,
    }),
  );
}

export async function searchDialogueOnly(
  query: string,
  limit = DEFAULT_LIMIT,
): Promise<SearchResult[]> {
  const results = await searchDialogueInternal(query, limit);
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export {
  memoryScopedSearch,
  isMemoryScopedHitType,
  isMemoryRecallHitType,
  MEMORY_SCOPED_HIT_TYPES,
  MEMORY_RECALL_HIT_TYPES,
  type MemoryScopedHit,
  type MemoryRecallHit,
  type MemoryScopedHitType,
  type MemoryRecallHitType,
  type MemoryScopedSearchResult,
  type MemoryRecallResult,
  type SemanticRecallHit,
  type ConversationRecallHit,
  type LimbicRecallHit,
  type AutobiographicalRecallHit,
} from "./recall-search.ts";
