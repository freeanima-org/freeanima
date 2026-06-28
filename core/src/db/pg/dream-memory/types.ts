import type { DreamEpisodicSnippet } from "@freeanima/core/db/schema";
import type { DreamMemoryRow } from "@freeanima/core/db/schema/rows";

export type { DreamEpisodicSnippet, DreamMemoryRow };

export type DreamMemoryCreateInput = {
  dream_day: string;
  content: string;
  source_limbic_ids?: string[];
  source_conversation_ids?: string[];
  episodic_snippets?: DreamEpisodicSnippet[];
  id?: string;
};
