import type { LimbicKind } from "@freeanima/core/db/schema";

export type { LimbicKind };

/** PG limbic_memory row */
export type LimbicMemoryRow = {
  id: string;
  conversation_id: string;
  kind: LimbicKind;
  valence: number | null;
  arousal: number | null;
  content: string;
  intensity: number;
  source_segment: string | null;
  semantic_memory_ids: string[];
  created: string;
};

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

/** Limbic memory persistence port */
export interface LimbicMemoryStorePort {
  create(row: LimbicMemoryCreateInput): Promise<string>;
  get(id: string): Promise<LimbicMemoryRow | null>;
  listByConversation(conversationId: string, opts?: { limit?: number }): Promise<LimbicMemoryRow[]>;
  listByConversations(
    conversationIds: string[],
    opts?: LimbicListByConversationsOpts,
  ): Promise<LimbicMemoryRow[]>;
  listByCreatedBetween(
    fromIso: string,
    toIso: string,
    opts?: LimbicListByCreatedOpts,
  ): Promise<LimbicMemoryRow[]>;
  list(opts?: LimbicListOpts): Promise<LimbicMemoryRow[]>;
  count(opts?: Omit<LimbicListOpts, "offset" | "limit">): Promise<number>;
  searchFts(query: string, opts?: { limit?: number }): Promise<LimbicFtsHit[]>;
}
