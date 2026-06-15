import type { DreamEpisodicSnippet } from "@freeanima/core/db/schema";
import type { DreamMemoryRow } from "@freeanima/core/repos";
import { normalizePgTimestamp } from "@freeanima/core/db/schema";

export type DreamMemoryDbRow = {
  id: string;
  dream_day?: string;
  dreamDay?: string;
  content: string;
  source_limbic_ids?: string[] | null;
  sourceLimbicIds?: string[] | null;
  source_session_ids?: string[] | null;
  sourceSessionIds?: string[] | null;
  episodic_snippets?: DreamEpisodicSnippet[] | null;
  episodicSnippets?: DreamEpisodicSnippet[] | null;
  created_at?: Date | string;
  createdAt?: Date | string;
};

export function mapDreamMemoryRow(row: DreamMemoryDbRow): DreamMemoryRow {
  const created = row.created_at ?? row.createdAt;
  return {
    id: row.id,
    dream_day: row.dream_day ?? row.dreamDay ?? "",
    content: row.content,
    source_limbic_ids: row.source_limbic_ids ?? row.sourceLimbicIds ?? [],
    source_session_ids: row.source_session_ids ?? row.sourceSessionIds ?? [],
    episodic_snippets: row.episodic_snippets ?? row.episodicSnippets ?? [],
    created: created != null ? normalizePgTimestamp(created) : "",
  };
}
