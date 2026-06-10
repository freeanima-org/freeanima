import type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticFtsHit,
} from "@freeanima/engine-repos";
import {
  autobiographicalDocKey,
  buildTextSearchSnippet,
  limbicDocKey,
  messageDocKey,
  rrfMerge,
  semanticMemoryDocKey,
} from "@freeanima/kernel-util";

import { getAutobiographicalMemoryStore } from "./autobiographical-port.ts";
import { getLimbicMemoryStore } from "./limbic-port.ts";
import { getSemanticMemoryStore } from "./semantic-port.ts";
import { searchDialogue } from "./search.ts";

export type MemoryRecallHitType = "semantic" | "session" | "limbic" | "autobiographical";

export type SemanticRecallHit = {
  memory_type: "semantic";
  score: number;
  semantic_memory_id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions: string[];
  observed_at: string | null;
  occurred_at: string | null;
  status: string;
};

export type SessionRecallHit = {
  memory_type: "session";
  score: number;
  session_id: string;
  message_id: string;
  role: string;
  timestamp: string;
  snippet: string;
};

export type LimbicRecallHit = {
  memory_type: "limbic";
  score: number;
  limbic_memory_id: string;
  kind: string;
  session_id: string;
  content: string;
  intensity: number;
  valence: number | null;
  arousal: number | null;
};

export type AutobiographicalRecallHit = {
  memory_type: "autobiographical";
  score: number;
  autobiographical_memory_id: string;
  title: string;
  snippet: string;
  significance: string;
};

export type MemoryRecallHit =
  | SemanticRecallHit
  | SessionRecallHit
  | LimbicRecallHit
  | AutobiographicalRecallHit;

export type MemoryRecallResult = {
  query: string;
  limit: number;
  results: MemoryRecallHit[];
  summary: string;
};

type RecallCandidate = {
  docKey: string;
  rank: number;
  memory_type: MemoryRecallHitType;
  semantic?: SemanticFtsHit;
  session?: {
    session_id: string;
    message_id: string;
    role: string;
    timestamp: string;
    content: string;
  };
  limbic?: LimbicMemoryRow;
  autobiographical?: AutobiographicalMemoryRow;
};

function candidateLimit(limit: number): number {
  return Math.max(limit * 3, 15);
}

function buildRecallSummary(query: string, results: MemoryRecallHit[]): string {
  if (results.length === 0) {
    return `No memories matched "${query}"`;
  }
  const counts: Record<MemoryRecallHitType, number> = {
    semantic: 0,
    session: 0,
    limbic: 0,
    autobiographical: 0,
  };
  for (const row of results) {
    counts[row.memory_type] += 1;
  }
  const parts: string[] = [];
  if (counts.semantic) parts.push(`semantic ${counts.semantic}`);
  if (counts.session) parts.push(`session ${counts.session}`);
  if (counts.limbic) parts.push(`limbic ${counts.limbic}`);
  if (counts.autobiographical) parts.push(`autobiographical ${counts.autobiographical}`);
  return `Found ${results.length} related memories (${parts.join(", ")})`;
}

function mapCandidateToHit(
  query: string,
  candidate: RecallCandidate,
  score: number,
): MemoryRecallHit {
  switch (candidate.memory_type) {
    case "semantic": {
      const row = candidate.semantic!;
      return {
        memory_type: "semantic",
        score,
        semantic_memory_id: row.id,
        type: row.type,
        pinned: row.pinned,
        content: row.content,
        source_sessions: row.source_sessions,
        observed_at: row.observed_at,
        occurred_at: row.occurred_at,
        status: row.status,
      };
    }
    case "session": {
      const row = candidate.session!;
      return {
        memory_type: "session",
        score,
        session_id: row.session_id,
        message_id: row.message_id,
        role: row.role,
        timestamp: row.timestamp,
        snippet: buildTextSearchSnippet(query, row.content),
      };
    }
    case "limbic": {
      const row = candidate.limbic!;
      return {
        memory_type: "limbic",
        score,
        limbic_memory_id: row.id,
        kind: row.kind,
        session_id: row.session_id,
        content: row.content,
        intensity: row.intensity,
        valence: row.valence,
        arousal: row.arousal,
      };
    }
    case "autobiographical": {
      const row = candidate.autobiographical!;
      return {
        memory_type: "autobiographical",
        score,
        autobiographical_memory_id: row.id,
        title: row.title,
        snippet: buildTextSearchSnippet(query, row.content),
        significance: row.significance,
      };
    }
  }
}

export async function memoryRecallSearch(
  query: string,
  opts?: { limit?: number; sessionId?: string },
): Promise<MemoryRecallResult> {
  const q = query.trim();
  const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
  const pool = candidateLimit(limit);
  const sessionId = opts?.sessionId?.trim() || undefined;

  const [semanticRows, sessionRows, limbicRows, autobiographicalRows] = await Promise.all([
    getSemanticMemoryStore().searchFts(q, { limit: pool }),
    searchDialogue(q, { limit: pool, sessionId }).catch(() => []),
    getLimbicMemoryStore()
      .list({ query: q, limit: pool })
      .catch(() => [] as LimbicMemoryRow[]),
    getAutobiographicalMemoryStore()
      .list({ query: q, limit: pool, status: "active" })
      .catch(() => [] as AutobiographicalMemoryRow[]),
  ]);

  const semanticList: RecallCandidate[] = semanticRows.map((row) => ({
    docKey: semanticMemoryDocKey(row.id),
    rank: 0,
    memory_type: "semantic",
    semantic: row,
  }));

  const sessionList: RecallCandidate[] = sessionRows.map((row) => ({
    docKey: messageDocKey(row.message_id),
    rank: 0,
    memory_type: "session",
    session: {
      session_id: row.session_id,
      message_id: row.message_id,
      role: row.role,
      timestamp: row.timestamp,
      content: row.content,
    },
  }));

  const limbicList: RecallCandidate[] = limbicRows.map((row) => ({
    docKey: limbicDocKey(row.id),
    rank: 0,
    memory_type: "limbic",
    limbic: row,
  }));

  const autobiographicalList: RecallCandidate[] = autobiographicalRows.map((row) => ({
    docKey: autobiographicalDocKey(row.id),
    rank: 0,
    memory_type: "autobiographical",
    autobiographical: row,
  }));

  const merged = rrfMerge([semanticList, sessionList, limbicList, autobiographicalList], { limit });

  const results = merged.map((row) => mapCandidateToHit(q, row as RecallCandidate, row.rank));

  return {
    query: q,
    limit,
    results,
    summary: buildRecallSummary(q, results),
  };
}
