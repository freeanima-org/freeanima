import type { SemanticMemoryRow } from "@freeanima/engine-repos";
import { normalizePgTimestamp } from "@freeanima/engine-db/schema";

export type SemanticMemoryDbRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  created: Date | string;
  updated: Date | string;
};

export function mapSemanticMemoryRow(row: SemanticMemoryDbRow): SemanticMemoryRow {
  return {
    id: row.id,
    type: row.type,
    pinned: row.pinned,
    content: row.content,
    created: normalizePgTimestamp(row.created),
    updated: normalizePgTimestamp(row.updated),
  };
}
