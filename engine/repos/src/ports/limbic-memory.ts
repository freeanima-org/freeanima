import type { LimbicKind } from "@freeanima/engine-db/schema";

export type { LimbicKind };

/** PG limbic_memory row */
export type LimbicMemoryRow = {
  id: string;
  session_id: string;
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
  session_id: string;
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
  session_id?: string;
  kind?: LimbicKind;
};

/** Limbic memory persistence port */
export interface LimbicMemoryStorePort {
  create(row: LimbicMemoryCreateInput): Promise<string>;
  get(id: string): Promise<LimbicMemoryRow | null>;
  listBySession(sessionId: string, opts?: { limit?: number }): Promise<LimbicMemoryRow[]>;
  list(opts?: LimbicListOpts): Promise<LimbicMemoryRow[]>;
  count(opts?: Omit<LimbicListOpts, "offset" | "limit">): Promise<number>;
}
