import type { SemanticMemoryRow } from "@freeanima/core/repos";
import { semanticMemory, normalizePgTimestamp } from "@freeanima/core/db/schema";

export type SemanticMemoryDbRow = typeof semanticMemory.$inferSelect;

/** snake_case columns from Tier-3 raw SQL (FTS / vector / trgm). */
export type SemanticMemoryRawDbRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions?: string[] | null;
  observed_at?: Date | string | null;
  occurred_at?: string | null;
  status?: string | null;
  reference_count?: number | null;
  created: Date | string;
  updated: Date | string;
};

export type SemanticMemoryFtsDbRow = SemanticMemoryRawDbRow & { rank: number };

export function mapSemanticMemoryRow(
  row: SemanticMemoryDbRow | SemanticMemoryRawDbRow,
): SemanticMemoryRow {
  const sourceSessions =
    "sourceSessions" in row ? (row.sourceSessions ?? []) : (row.source_sessions ?? []);
  const observedRaw = "observedAt" in row ? row.observedAt : row.observed_at;
  const occurredAt = "occurredAt" in row ? row.occurredAt : row.occurred_at;
  const referenceCount = "referenceCount" in row ? row.referenceCount : (row.reference_count ?? 0);
  return {
    id: row.id,
    type: row.type,
    pinned: row.pinned,
    content: row.content,
    source_sessions: sourceSessions,
    observed_at: observedRaw != null ? normalizePgTimestamp(observedRaw) : null,
    occurred_at: occurredAt ?? null,
    status: row.status ?? "active",
    reference_count: Number(referenceCount ?? 0),
    created: normalizePgTimestamp(row.created),
    updated: normalizePgTimestamp(row.updated),
  };
}
