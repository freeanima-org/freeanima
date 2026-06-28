import type { LimbicMemoryRow } from "@freeanima/core/repos";
import {
  limbicKindSchema,
  limbicMemory,
  normalizePgTimestamp,
  type LimbicKind,
} from "@freeanima/core/db/schema";

export type LimbicMemoryDbRow = typeof limbicMemory.$inferSelect;

function normalizeKind(raw: string): LimbicKind {
  const parsed = limbicKindSchema.safeParse(String(raw).trim());
  if (!parsed.success) throw new Error(`invalid limbic kind: ${raw}`);
  return parsed.data;
}

export function mapLimbicMemoryRow(row: LimbicMemoryDbRow): LimbicMemoryRow {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    kind: normalizeKind(row.kind),
    valence: row.valence ?? null,
    arousal: row.arousal ?? null,
    content: row.content,
    intensity: row.intensity,
    source_segment: row.source_segment ?? null,
    semantic_memory_ids: row.semantic_memory_ids ?? [],
    created: normalizePgTimestamp(row.created_at),
  };
}
