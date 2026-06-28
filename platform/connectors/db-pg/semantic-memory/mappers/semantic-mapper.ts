import type { SemanticMemoryRow } from "@freeanima/core/repos";
import { normalizePgTimestamp, semanticMemory } from "@freeanima/core/db/schema";
import { semanticMemoryRowSchema } from "@freeanima/core/repos";

export type SemanticMemoryDbRow = typeof semanticMemory.$inferSelect;

export function mapSemanticMemoryRow(row: SemanticMemoryDbRow): SemanticMemoryRow {
  return semanticMemoryRowSchema.parse({
    ...row,
    source_conversations: row.source_conversations ?? [],
    observed_at: row.observed_at != null ? normalizePgTimestamp(row.observed_at) : null,
    occurred_at: row.occurred_at ?? null,
    status: row.status ?? "active",
    reference_count: Number(row.reference_count ?? 0),
    created: normalizePgTimestamp(row.created),
    updated: normalizePgTimestamp(row.updated),
  });
}
