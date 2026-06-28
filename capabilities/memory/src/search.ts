import type { MessageFtsHit } from "@freeanima/core/repos";
import { searchSemanticMemoryFts } from "@freeanima/core/db/pg/semantic-memory";
import { searchMessagesFts } from "@freeanima/core/db/pg/conversation";

export type SearchResult = {
  content: string;
  source: "semantic_memory" | "dialogue";
  path: string;
  score: number;
  metadata: Record<string, unknown>;
};

const DEFAULT_LIMIT = 10;

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
  } catch {
    return [];
  }
}

export async function search(query: string, limit = DEFAULT_LIMIT): Promise<SearchResult[]> {
  const results: SearchResult[] = [];
  try {
    results.push(...(await searchSemanticMemoryInternal(query, limit)));
  } catch {
    /* ignore */
  }
  try {
    results.push(...(await searchDialogueInternal(query, limit)));
  } catch {
    /* ignore */
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
  return searchMessagesFts(query, {
    conversation_id: opts?.conversationId,
    limit: opts?.limit,
  });
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
  memoryRecallSearch,
  type MemoryRecallHit,
  type MemoryRecallHitType,
  type MemoryRecallResult,
  type SemanticRecallHit,
  type ConversationRecallHit,
  type LimbicRecallHit,
  type AutobiographicalRecallHit,
} from "./recall-search.ts";
