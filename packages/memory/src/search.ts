import { join } from "node:path";
import { PATHS } from "@freeanima/kernel";
import { getStore } from "./store.js";
import { factScore } from "./fact.js";
import { searchL2 } from "./l2-indexer.js";
import { searchL3Fts } from "./l3-indexer.js";

export type SearchResult = {
  content: string;
  source: "l3" | "l2";
  path: string;
  score: number;
  metadata: Record<string, unknown>;
};

const DEFAULT_LIMIT = 10;

function ftsRankToScore(rank: number): number {
  const raw = -rank;
  return Math.min(1.0, Math.max(0.1, raw / 5.0));
}

function searchL3Internal(query: string): SearchResult[] {
  try {
    const rows = searchL3Fts(query, DEFAULT_LIMIT);
    if (rows.length) {
      return rows.map((r) => ({
        content: r.content,
        source: "l3" as const,
        path: join(PATHS.memory, `${r.fact_id}.md`),
        score: ftsRankToScore(r.rank),
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

function searchL2Internal(query: string): SearchResult[] {
  try {
    const rows = searchL2(query, { limit: DEFAULT_LIMIT });
    return rows.map((row) => ({
      content: row.content,
      source: "l2" as const,
      path: join(PATHS.processed, `${row.session_id}.jsonl`),
      score: ftsRankToScore(row.rank),
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

export function search(query: string, limit = DEFAULT_LIMIT): SearchResult[] {
  const results: SearchResult[] = [];
  try {
    results.push(...searchL3Internal(query));
  } catch {
    /* ignore */
  }
  try {
    results.push(...searchL2Internal(query));
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

export function searchL2Only(query: string, limit = DEFAULT_LIMIT): SearchResult[] {
  const results = searchL2Internal(query);
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

export function memorySearchDetailed(
  query: string,
  opts?: { l3Limit?: number; l2Limit?: number; sessionId?: string },
): MemorySearchResult {
  const q = query.trim();
  const l3Limit = Math.max(1, Math.min(50, opts?.l3Limit ?? 5));
  const l2Limit = Math.max(1, Math.min(50, opts?.l2Limit ?? 10));

  const l3Rows = searchL3Fts(q, l3Limit);
  const l2Rows = searchL2(q, { limit: l2Limit, sessionId: opts?.sessionId });

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
      score: ftsRankToScore(r.rank),
    })),
    l2: l2Rows.map((r) => ({
      content: r.content,
      role: r.role,
      session_id: r.session_id,
      timestamp: r.timestamp,
      rank: r.rank,
      score: ftsRankToScore(r.rank),
    })),
  };
}
