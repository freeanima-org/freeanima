import type {
  AutobiographicalMemoryRow,
  LimbicMemoryRow,
  SemanticFtsHit,
} from "@freeanima/habitat/core/db/schema/rows";
import { buildTextSearchSnippet, validateFtsQueryInput } from "@freeanima/habitat/core/util";

import type { MessageFtsHit } from "@freeanima/habitat/core/db/pg/conversation/types";
import { searchAutobiographicalMemoryFts } from "@freeanima/habitat/core/db/pg/autobiographical-memory";
import { searchLimbicMemoryFts } from "@freeanima/habitat/core/db/pg/limbic-memory";
import { searchSemanticMemoryFts } from "@freeanima/habitat/core/db/pg/semantic-memory";
import { cstDaySourceRef, notifySoftFailure } from "@freeanima/habitat/core/soft-failure";
import { searchDialogue } from "./search.ts";

type LimbicFtsHit = LimbicMemoryRow & { rank?: number };
type AutobiographicalFtsHit = AutobiographicalMemoryRow & { rank: number };

function notifyRecallSearchSoftFailure(kind: string, error: unknown): void {
  const message = error instanceof Error ? error.message : String(error);
  void notifySoftFailure({
    sourceRef: cstDaySourceRef(`memory:recall_search_failed:${kind}`),
    title: "记忆 scoped 检索失败（已返回空结果）",
    body: [`scoped 记忆检索通道「${kind}」出错，该通道已按空结果继续。`, `错误：${message}`].join(
      "\n",
    ),
    payload: { kind: "memory_recall_search_failed", channel: kind, error: message },
    logLabel: "memory_recall_search",
  });
}

/** Habitat debug / service scopes (not an LLM unified tool). */
export type MemoryScopedHitType = "semantic" | "conversation" | "limbic" | "autobiographical";

export const MEMORY_SCOPED_HIT_TYPES: readonly MemoryScopedHitType[] = [
  "semantic",
  "conversation",
  "limbic",
  "autobiographical",
] as const;

/** @deprecated Use MemoryScopedHitType */
export type MemoryRecallHitType = MemoryScopedHitType;
/** @deprecated Use MEMORY_SCOPED_HIT_TYPES */
export const MEMORY_RECALL_HIT_TYPES = MEMORY_SCOPED_HIT_TYPES;

const MEMORY_SCOPED_HIT_TYPE_SET = new Set<string>(MEMORY_SCOPED_HIT_TYPES);

export function isMemoryScopedHitType(value: string): value is MemoryScopedHitType {
  return MEMORY_SCOPED_HIT_TYPE_SET.has(value);
}

/** @deprecated Use isMemoryScopedHitType */
export const isMemoryRecallHitType = isMemoryScopedHitType;

function resolveScopedTypes(types?: readonly MemoryScopedHitType[]): Set<MemoryScopedHitType> {
  if (!types || types.length === 0) return new Set(MEMORY_SCOPED_HIT_TYPES);
  return new Set(types);
}

export type SemanticRecallHit = {
  memory_type: "semantic";
  score: number;
  semantic_memory_id: number;
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

export type MemoryScopedHit =
  | SemanticRecallHit
  | ConversationRecallHit
  | LimbicRecallHit
  | AutobiographicalRecallHit;

/** @deprecated Use MemoryScopedHit */
export type MemoryRecallHit = MemoryScopedHit;

export type MemoryScopedSearchResult = {
  query: string;
  limit: number;
  results: MemoryScopedHit[];
  summary: string;
  truncated: boolean;
  next_hint?: string;
};

/** @deprecated Use MemoryScopedSearchResult */
export type MemoryRecallResult = MemoryScopedSearchResult;

function pgRankToScore(rank: number): number {
  return Math.min(1.0, Math.max(0.1, rank * 5.0));
}

function buildScopedSummary(query: string, results: MemoryScopedHit[]): string {
  if (results.length === 0) {
    return `No memories matched "${query}"`;
  }
  const counts: Record<MemoryScopedHitType, number> = {
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

function mapSemantic(row: SemanticFtsHit): SemanticRecallHit {
  return {
    memory_type: "semantic",
    score: pgRankToScore(row.rank),
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

function mapConversation(
  query: string,
  row: {
    conversation_id: string;
    message_id: string;
    role: string;
    timestamp: string;
    content: string;
    rank: number;
  },
): ConversationRecallHit {
  return {
    memory_type: "conversation",
    score: pgRankToScore(row.rank),
    conversation_id: row.conversation_id,
    message_id: row.message_id,
    role: row.role,
    timestamp: row.timestamp,
    snippet: buildTextSearchSnippet(query, row.content),
  };
}

function mapLimbic(row: LimbicMemoryRow & { rank?: number }): LimbicRecallHit {
  return {
    memory_type: "limbic",
    score: row.rank != null ? pgRankToScore(row.rank) : 0.5,
    limbic_memory_id: row.id,
    kind: row.kind,
    conversation_id: row.conversation_id,
    content: row.content,
    intensity: row.intensity,
    valence: row.valence,
    arousal: row.arousal,
  };
}

function mapAutobiographical(
  query: string,
  row: AutobiographicalMemoryRow & { rank: number },
): AutobiographicalRecallHit {
  return {
    memory_type: "autobiographical",
    score: pgRankToScore(row.rank),
    autobiographical_memory_id: row.id,
    title: row.title,
    snippet: buildTextSearchSnippet(query, row.content),
    significance: row.significance,
  };
}

/**
 * Habitat / service scoped memory search: each selected scope is queried independently
 * (per-scope limit), then concatenated in fixed type order. No cross-type RRF.
 */
export async function memoryScopedSearch(
  query: string,
  opts?: { limit?: number; memory_types?: readonly MemoryScopedHitType[] },
): Promise<MemoryScopedSearchResult> {
  const q = query.trim();
  const limit = Math.max(1, Math.min(20, opts?.limit ?? 10));
  const wanted = resolveScopedTypes(opts?.memory_types);

  validateFtsQueryInput(q);

  const [semanticRows, conversationRows, limbicRows, autobiographicalRows] = await Promise.all([
    wanted.has("semantic")
      ? searchSemanticMemoryFts(q, { limit })
      : Promise.resolve([] as SemanticFtsHit[]),
    wanted.has("conversation")
      ? searchDialogue(q, { limit }).catch((error: unknown): MessageFtsHit[] => {
          notifyRecallSearchSoftFailure("conversation", error);
          return [];
        })
      : Promise.resolve([] as MessageFtsHit[]),
    wanted.has("limbic")
      ? searchLimbicMemoryFts(q, { limit }).catch((error: unknown): LimbicFtsHit[] => {
          notifyRecallSearchSoftFailure("limbic", error);
          return [];
        })
      : Promise.resolve([] as LimbicFtsHit[]),
    wanted.has("autobiographical")
      ? searchAutobiographicalMemoryFts(q, { limit }).catch(
          (error: unknown): AutobiographicalFtsHit[] => {
            notifyRecallSearchSoftFailure("autobiographical", error);
            return [];
          },
        )
      : Promise.resolve([] as AutobiographicalFtsHit[]),
  ]);

  const results: MemoryScopedHit[] = [];
  if (wanted.has("semantic")) results.push(...semanticRows.slice(0, limit).map(mapSemantic));
  if (wanted.has("conversation")) {
    results.push(...conversationRows.slice(0, limit).map((row) => mapConversation(q, row)));
  }
  if (wanted.has("limbic")) results.push(...limbicRows.slice(0, limit).map(mapLimbic));
  if (wanted.has("autobiographical")) {
    results.push(...autobiographicalRows.slice(0, limit).map((row) => mapAutobiographical(q, row)));
  }

  return {
    query: q,
    limit,
    results,
    summary: buildScopedSummary(q, results),
    truncated: results.length >= limit,
    ...(results.length >= limit
      ? {
          next_hint:
            "Result page full for this limit; raise limit (max 20), narrow memory_types, or refine query.",
        }
      : {}),
  };
}
