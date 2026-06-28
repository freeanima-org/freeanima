import type { DreamMemoryRow } from "@freeanima/core/repos";
import { dreamMemory, normalizePgTimestamp } from "@freeanima/core/db/schema";

export type DreamMemoryDbRow = typeof dreamMemory.$inferSelect;

export function mapDreamMemoryRow(row: DreamMemoryDbRow): DreamMemoryRow {
  return {
    id: row.id,
    dream_day: row.dream_day,
    content: row.content,
    source_limbic_ids: row.source_limbic_ids ?? [],
    source_conversation_ids: row.source_conversation_ids ?? [],
    episodic_snippets: row.episodic_snippets ?? [],
    created: normalizePgTimestamp(row.created_at),
  };
}
