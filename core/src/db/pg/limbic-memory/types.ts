import type { LimbicKind } from "@freeanima/core/db/schema";
import type { LimbicMemoryRow } from "@freeanima/core/db/schema/rows";

export type { LimbicKind, LimbicMemoryRow };

export type LimbicMemoryCreateInput = {
  conversation_id: string;
  kind: LimbicKind;
  content: string;
  valence?: number | null;
  arousal?: number | null;
  intensity?: number;
  source_segment?: string | null;
  semantic_memory_ids?: string[];
  id?: string;
};

export type LimbicListOpts = {
  query?: string;
  offset?: number;
  limit?: number;
  conversation_id?: string;
  kind?: LimbicKind;
};

export type LimbicListByConversationsOpts = {
  minIntensity?: number;
  limit?: number;
  orderBy?: "intensity_desc";
};

export type LimbicListByCreatedOpts = {
  minIntensity?: number;
  limit?: number;
  orderBy?: "intensity_desc";
};

export type LimbicFtsHit = LimbicMemoryRow & {
  rank: number;
};
