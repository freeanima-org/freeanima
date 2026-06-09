import type { MessageFtsHit } from "@freeanima/engine-repos";
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

/** PG ts_rank_cd（正值，越大越相关） */
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

export type SemanticMemorySearchHit = {
  semantic_memory_id: string;
  content: string;
  type: string;
  pinned: boolean;
  rank: number;
  score: number;
};

export type DialogueSearchHit = {
  session_id: string;
  message_id: string;
};

export type MemorySearchResult = {
  query: string;
  semantic_memory: SemanticMemorySearchHit[];
  dialogue: DialogueSearchHit[];
};

export async function memorySearchDetailed(
  query: string,
  opts?: { semanticLimit?: number; dialogueLimit?: number; sessionId?: string },
): Promise<MemorySearchResult> {
  const q = query.trim();
  const semanticLimit = Math.max(1, Math.min(50, opts?.semanticLimit ?? 5));
  const dialogueLimit = Math.max(1, Math.min(50, opts?.dialogueLimit ?? 10));

  const store = getSemanticMemoryStore();
  const semanticRows = await store.searchFts(q, { limit: semanticLimit });
  const dialogueRows = await searchDialogue(q, {
    limit: dialogueLimit,
    sessionId: opts?.sessionId,
  });

  return {
    query: q,
    semantic_memory: semanticRows.map((r) => ({
      semantic_memory_id: r.id,
      content: r.content,
      type: r.type,
      pinned: r.pinned,
      rank: r.rank,
      score: pgRankToScore(r.rank),
    })),
    dialogue: dialogueRows.map((r) => ({
      session_id: r.session_id,
      message_id: r.message_id,
    })),
  };
}
