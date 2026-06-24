import type { LimbicMemoryRow } from "@freeanima/core/repos";
import { limbicKindSchema, normalizePgTimestamp, type LimbicKind } from "@freeanima/core/db/schema";

export type LimbicMemoryDbRow = {
  id: string;
  conversation_id?: string;
  conversationId?: string;
  kind: string;
  valence?: number | null;
  arousal?: number | null;
  content: string;
  intensity: number;
  source_segment?: string | null;
  sourceSegment?: string | null;
  semantic_memory_ids?: string[] | null;
  semanticMemoryIds?: string[] | null;
  created_at?: Date | string;
  createdAt?: Date | string;
  /** Already mapped row (RRF merge path). */
  created?: Date | string;
};

function normalizeKind(raw: string): LimbicKind {
  const parsed = limbicKindSchema.safeParse(String(raw).trim());
  if (!parsed.success) throw new Error(`invalid limbic kind: ${raw}`);
  return parsed.data;
}

export function mapLimbicMemoryRow(row: LimbicMemoryDbRow): LimbicMemoryRow {
  const created = row.created_at ?? row.createdAt ?? row.created;
  return {
    id: row.id,
    conversation_id: row.conversation_id ?? row.conversationId ?? "",
    kind: normalizeKind(row.kind),
    valence: row.valence ?? null,
    arousal: row.arousal ?? null,
    content: row.content,
    intensity: row.intensity,
    source_segment: row.source_segment ?? row.sourceSegment ?? null,
    semantic_memory_ids: row.semantic_memory_ids ?? row.semanticMemoryIds ?? [],
    created: created != null ? normalizePgTimestamp(created) : "",
  };
}
