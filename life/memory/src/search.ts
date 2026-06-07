import type { MessageFtsHit } from "@freeanima/engine-repos";
import { getSemanticMemoryStore } from "./semantic-port.ts";
import { getMemorySessionStore } from "./session-port.ts";

export type SearchResult = {
  content: string;
  source: "l3" | "l2";
  path: string;
  score: number;
  metadata: Record<string, unknown>;
};

const DEFAULT_LIMIT = 10;

/** PG ts_rank（正值，越大越相关） */
function pgRankToScore(rank: number): number {
  return Math.min(1.0, Math.max(0.1, rank * 5.0));
}

async function searchL3Internal(query: string, limit = DEFAULT_LIMIT): Promise<SearchResult[]> {
  const store = getSemanticMemoryStore();
  const rows = await store.searchFts(query, { limit });
  return rows.map((r) => ({
    content: r.content,
    source: "l3" as const,
    path: `pg:semantic_memory:${r.id}`,
    score: pgRankToScore(r.rank),
    metadata: {
      id: r.id,
      type: r.type,
      pinned: r.pinned,
    },
  }));
}

async function searchL2Internal(query: string, limit = DEFAULT_LIMIT): Promise<SearchResult[]> {
  try {
    const rows = await searchL2(query, { limit });
    return rows.map((row) => ({
      content: row.content,
      source: "l2" as const,
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
    results.push(...(await searchL3Internal(query, limit)));
  } catch {
    /* ignore */
  }
  try {
    results.push(...(await searchL2Internal(query, limit)));
  } catch {
    /* ignore */
  }
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export async function searchL3(query: string, limit = DEFAULT_LIMIT): Promise<SearchResult[]> {
  const results = await searchL3Internal(query, limit);
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export async function searchL2(
  query: string,
  opts?: { sessionId?: string; limit?: number },
): Promise<MessageFtsHit[]> {
  const store = getMemorySessionStore();
  return store.searchMessagesFts(query, {
    sessionId: opts?.sessionId,
    limit: opts?.limit,
  });
}

export async function searchL2Only(query: string, limit = DEFAULT_LIMIT): Promise<SearchResult[]> {
  const results = await searchL2Internal(query, limit);
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, limit);
}

export type MemorySearchL3Hit = {
  semantic_memory_id: string;
  content: string;
  type: string;
  pinned: boolean;
  rank: number;
  score: number;
};

export type MemorySearchL2Hit = {
  content: string;
  role: string;
  session_id: string;
  timestamp: string;
  rank: number;
  score: number;
};

export type MemorySearchResult = {
  query: string;
  l3: MemorySearchL3Hit[];
  l2: MemorySearchL2Hit[];
};

export async function memorySearchDetailed(
  query: string,
  opts?: { l3Limit?: number; l2Limit?: number; sessionId?: string },
): Promise<MemorySearchResult> {
  const q = query.trim();
  const l3Limit = Math.max(1, Math.min(50, opts?.l3Limit ?? 5));
  const l2Limit = Math.max(1, Math.min(50, opts?.l2Limit ?? 10));

  const store = getSemanticMemoryStore();
  const l3Rows = await store.searchFts(q, { limit: l3Limit });
  const l2Rows = await searchL2(q, { limit: l2Limit, sessionId: opts?.sessionId });

  return {
    query: q,
    l3: l3Rows.map((r) => ({
      semantic_memory_id: r.id,
      content: r.content,
      type: r.type,
      pinned: r.pinned,
      rank: r.rank,
      score: pgRankToScore(r.rank),
    })),
    l2: l2Rows.map((r) => ({
      content: r.content,
      role: r.role,
      session_id: r.session_id,
      timestamp: r.timestamp,
      rank: r.rank,
      score: pgRankToScore(r.rank),
    })),
  };
}
