export type MemoryRecallHit = {
  memory_type: string;
  score: number;
  semantic_memory_id?: string;
  type?: string;
  pinned?: boolean;
  content?: string;
  source_sessions?: string[];
  observed_at?: string | null;
  occurred_at?: string | null;
  status?: string;
  session_id?: string;
  message_id?: string;
  role?: string;
  timestamp?: string;
  snippet?: string;
  limbic_memory_id?: string;
  kind?: string;
  intensity?: number;
  valence?: number | null;
  arousal?: number | null;
  autobiographical_memory_id?: string;
  title?: string;
  significance?: string;
};

export type MemoryRecallResult = {
  query: string;
  limit: number;
  results: MemoryRecallHit[];
  summary: string;
};

export const MEMORY_RECALL_TYPES = ["semantic", "session", "limbic", "autobiographical"] as const;

export type MemoryRecallType = (typeof MEMORY_RECALL_TYPES)[number];

export function recallHitKey(hit: MemoryRecallHit): string {
  if (hit.memory_type === "semantic" && hit.semantic_memory_id) {
    return `semantic-${hit.semantic_memory_id}`;
  }
  if (hit.memory_type === "session" && hit.message_id) {
    return `session-${hit.message_id}`;
  }
  if (hit.memory_type === "limbic" && hit.limbic_memory_id) {
    return `limbic-${hit.limbic_memory_id}`;
  }
  if (hit.memory_type === "autobiographical" && hit.autobiographical_memory_id) {
    return `autobio-${hit.autobiographical_memory_id}`;
  }
  return `${hit.memory_type}-${hit.score}`;
}

export function countByMemoryType(results: MemoryRecallHit[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const hit of results) {
    counts[hit.memory_type] = (counts[hit.memory_type] ?? 0) + 1;
  }
  return counts;
}
