import type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticFtsHit,
} from "@freeanima/core/repos";
import {
  autobiographicalDocKey,
  buildTextSearchSnippet,
  limbicDocKey,
  messageDocKey,
  rrfMerge,
  semanticMemoryDocKey,
  validateFtsQueryInput,
} from "@freeanima/core/util";

import { searchAutobiographicalMemoryFts } from "@freeanima/core/db/pg/autobiographical-memory";
import { searchLimbicMemoryFts } from "@freeanima/core/db/pg/limbic-memory";
import { searchSemanticMemoryFts } from "@freeanima/core/db/pg/semantic-memory";
import { searchDialogue } from "./search.ts";

export type MemoryRecallHitType = "semantic" | "conversation" | "limbic" | "autobiographical";

export type SemanticRecallHit = {
  memory_type: "semantic";
  score: number;
  semantic_memory_id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_conversations: string[];
  observed_at: string | null;
  occurred_at: string | null;
  status: string;
};

export type ConversationRecallHit = {
  memory_type: "conversation";
  score: number;
  conversation_id: string;
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
  conversation_id: string;
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
  | ConversationRecallHit
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
  memory_type: MemoryRecallHitType;
  semantic?: SemanticFtsHit;
  conversation?: {
    conversation_id: string;
    message_id: string;
    role: string;
    timestamp: string;
    content: string;
  };
  limbic?: LimbicMemoryRow | (LimbicMemoryRow & { rank: number });
  autobiographical?: AutobiographicalMemoryRow | (AutobiographicalMemoryRow & { rank: number });
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
    conversation: 0,
    limbic: 0,
    autobiographical: 0,
  };
  for (const row of results) {
    counts[row.memory_type] += 1;
  }
  const parts: string[] = [];
  if (counts.semantic) parts.push(`semantic ${counts.semantic}`);
  if (counts.conversation) parts.push(`conversation ${counts.conversation}`);
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
      const row = candidate.semantic;
      if (!row) throw new Error("recall candidate missing semantic row");
      return {
        memory_type: "semantic",
        score,
        semantic_memory_id: row.id,
        type: row.type,
        pinned: row.pinned,
        content: row.content,
        source_conversations: row.source_conversations,
        observed_at: row.observed_at?.toISOString() ?? null,
        occurred_at: row.occurred_at,
        status: row.status,
      };
    }
    case "conversation": {
      const row = candidate.conversation;
      if (!row) throw new Error("recall candidate missing conversation row");
      return {
        memory_type: "conversation",
        score,
        conversation_id: row.conversation_id,
        message_id: row.message_id,
        role: row.role,
        timestamp: row.timestamp,
        snippet: buildTextSearchSnippet(query, row.content),
      };
    }
    case "limbic": {
      const row = candidate.limbic;
      if (!row) throw new Error("recall candidate missing limbic row");
      return {
        memory_type: "limbic",
        score,
        limbic_memory_id: row.id,
        kind: row.kind,
        conversation_id: row.conversation_id,
        content: row.content,
        intensity: row.intensity,
        valence: row.valence,
        arousal: row.arousal,
      };
    }
    case "autobiographical": {
      const row = candidate.autobiographical;
      if (!row) throw new Error("recall candidate missing autobiographical row");
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
  opts?: { limit?: number },
): Promise<MemoryRecallResult> {
  const q = query.trim();
  const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
  const pool = candidateLimit(limit);

  validateFtsQueryInput(q);

  const [semanticRows, conversationRows, limbicRows, autobiographicalRows] = await Promise.all([
    searchSemanticMemoryFts(q, { limit: pool }),
    searchDialogue(q, { limit: pool }).catch(() => []),
    searchLimbicMemoryFts(q, { limit: pool }).catch(() => []),
    searchAutobiographicalMemoryFts(q, { limit: pool, status: "active" }).catch(() => []),
  ]);

  const semanticList: RecallCandidate[] = semanticRows.map((row) => ({
    docKey: semanticMemoryDocKey(row.id),
    memory_type: "semantic",
    semantic: row,
  }));

  const conversationList: RecallCandidate[] = conversationRows.map((row) => ({
    docKey: messageDocKey(row.message_id),
    memory_type: "conversation",
    conversation: {
      conversation_id: row.conversation_id,
      message_id: row.message_id,
      role: row.role,
      timestamp: row.timestamp,
      content: row.content,
    },
  }));

  const limbicList: RecallCandidate[] = limbicRows.map((row) => ({
    docKey: limbicDocKey(row.id),
    memory_type: "limbic",
    limbic: row,
  }));

  const autobiographicalList: RecallCandidate[] = autobiographicalRows.map((row) => ({
    docKey: autobiographicalDocKey(row.id),
    memory_type: "autobiographical",
    autobiographical: row,
  }));

  const merged = rrfMerge([semanticList, conversationList, limbicList, autobiographicalList], {
    limit,
  });

  const results = merged.map((row) => mapCandidateToHit(q, row as RecallCandidate, row.score));

  return {
    query: q,
    limit,
    results,
    summary: buildRecallSummary(q, results),
  };
}
