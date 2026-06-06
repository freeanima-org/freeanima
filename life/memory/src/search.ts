import { join } from "node:path";
import { PATHS } from "@freeanima/service-config";
import type { MessageFtsHit } from "@freeanima/engine-repos";
import { getStore } from "./store.ts";
import { factScore } from "./fact.ts";
import { searchL3Fts } from "./l3-indexer.ts";
import { getMemorySessionStore } from "./session-port.ts";

export type SearchResult = {
  content: string;
  source: "l3" | "l2";
  path: string;
  score: number;
  metadata: Record<string, unknown>;
};

const DEFAULT_LIMIT = 10;

/** SQLite FTS5 rank（负值，越小越相关） */
function sqliteRankToScore(rank: number): number {
  const raw = -rank;
  return Math.min(1.0, Math.max(0.1, raw / 5.0));
}

/** PG ts_rank（正值，越大越相关） */
function pgRankToScore(rank: number): number {
  return Math.min(1.0, Math.max(0.1, rank * 5.0));
}

function searchL3Internal(query: string): SearchResult[] {
  try {
    const rows = searchL3Fts(query, DEFAULT_LIMIT);
    if (rows.length) {
      return rows.map((r) => ({
        content: r.content,
        source: "l3" as const,
        path: join(PATHS.memory, `${r.fact_id}.md`),
        score: sqliteRankToScore(r.rank),
        metadata: {
          id: r.fact_id,
          type: r.type,
          confidence: r.confidence,
          importance: r.importance,
          recall: r.recall,
          domains: r.domains,
          entities: r.entities,
          sources: r.sources,
        },
      }));
    }
  } catch {
    /* fallback */
  }

  const store = getStore();
  return store.search(query).map((f) => ({
    content: f.content,
    source: "l3" as const,
    path: join(PATHS.memory, `${f.id}.md`),
    score: factScore(f),
    metadata: {
      id: f.id,
      confidence: f.confidence,
      importance: f.importance,
      recall: f.recall,
      domains: f.domains,
      entities: f.entities,
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
    results.push(...searchL3Internal(query));
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

export function searchL3(query: string, limit = DEFAULT_LIMIT): SearchResult[] {
  const results = searchL3Internal(query);
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
  fact_id: string;
  content: string;
  type: string;
  confidence: number;
  importance: number;
  recall: number;
  domains: string[];
  entities: string[];
  sources: Record<string, unknown>[];
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

  const l3Rows = searchL3Fts(q, l3Limit);
  const l2Rows = await searchL2(q, { limit: l2Limit, sessionId: opts?.sessionId });

  return {
    query: q,
    l3: l3Rows.map((r) => ({
      fact_id: r.fact_id,
      content: r.content,
      type: r.type,
      confidence: r.confidence,
      importance: r.importance,
      recall: r.recall,
      domains: r.domains,
      entities: r.entities,
      sources: r.sources,
      rank: r.rank,
      score: sqliteRankToScore(r.rank),
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
