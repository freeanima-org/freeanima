import type { MessageFtsHit } from "@freeanima/core/repos";
import { getSemanticMemoryStore } from "./semantic-port.ts";
import { getMemorySessionStore } from "./session-port.ts";

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
  const store = getSemanticMemoryStore();
  const rows = await store.searchFts(query, { limit });
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
      path: `pg:messages:${row.session_id}`,
      score: pgRankToScore(row.rank),
      metadata: {
        role: row.role,
        session_id: row.session_id,
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
  opts?: { sessionId?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  const store = getMemorySessionStore();
  return store.searchMessagesFts(query, {
    sessionId: opts?.sessionId,
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
  type SessionRecallHit,
  type LimbicRecallHit,
  type AutobiographicalRecallHit,
} from "./recall-search.ts";
