import type { SemanticMemoryRow } from "@freeanima/engine-repos";
import { normalizePgTimestamp } from "@freeanima/engine-db/schema";

export type SemanticMemoryDbRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions?: string[] | null;
  sourceSessions?: string[] | null;
  observed_at?: Date | string | null;
  observedAt?: Date | string | null;
  occurred_at?: string | null;
  occurredAt?: string | null;
  status?: string | null;
  reference_count?: number | null;
  referenceCount?: number | null;
  created: Date | string;
  updated: Date | string;
};

export function mapSemanticMemoryRow(row: SemanticMemoryDbRow): SemanticMemoryRow {
  const sourceSessions = row.source_sessions ?? row.sourceSessions ?? [];
  const observedRaw = row.observed_at ?? row.observedAt;
  return {
    id: row.id,
    type: row.type,
    pinned: row.pinned,
    content: row.content,
    source_sessions: sourceSessions,
    observed_at: observedRaw != null ? normalizePgTimestamp(observedRaw) : null,
    occurred_at: row.occurred_at ?? row.occurredAt ?? null,
    status: row.status ?? "active",
    reference_count: Number(row.reference_count ?? row.referenceCount ?? 0),
    created: normalizePgTimestamp(row.created),
    updated: normalizePgTimestamp(row.updated),
  };
}
