/** Default resident memory slot count injected into system prompt */
export const RESIDENT_TOP_N = 20;

/** Max pinned memories included in resident context (excess triggers warn log) */
export const RESIDENT_PINNED_MAX = 40;

/** PG semantic_memory row (consumed by capabilities-memory / recall / remember) */
export type SemanticMemoryRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions: string[];
  observed_at: string | null;
  occurred_at: string | null;
  status: string;
  reference_count: number;
  created: string;
  updated: string;
};

/** PG semantic_memory.content_fts hit row */
export type SemanticFtsHit = SemanticMemoryRow & {
  rank: number;
};

export type SemanticMemoryCreateInput = {
  content: string;
  type?: string;
  pinned?: boolean;
  id?: string;
  source_sessions?: string[];
  observed_at?: string | null;
  occurred_at?: string | null;
  status?: string;
  created?: string;
  updated?: string;
};

/** Overlay update: only passed fields change; source_sessions [] clears */
export type SemanticMemoryUpdateInput = {
  id: string;
  content?: string;
  type?: string;
  pinned?: boolean;
  source_sessions?: string[];
  observed_at?: string | null;
  occurred_at?: string | null;
  status?: string;
};

export type SemanticMemorySortBy = "created" | "updated" | "reference_count" | "rank";

export type SemanticMemorySearchOpts = {
  query?: string;
  offset?: number;
  limit?: number;
  types?: string[];
  status?: "active" | "deprecated" | "all";
  source_sessions?: string[];
  sort_by?: SemanticMemorySortBy;
};

/** Semantic memory persistence port (Slice B — semantic_memory table) */
export interface SemanticMemoryStorePort {
  create(row: SemanticMemoryCreateInput): Promise<string>;
  get(id: string): Promise<SemanticMemoryRow | null>;
  update(row: SemanticMemoryUpdateInput): Promise<void>;
  deprecate(id: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  /** Active semantic memory row count */
  count(): Promise<number>;
  listResident(topN?: number): Promise<SemanticMemoryRow[]>;
  listAll(): Promise<SemanticMemoryRow[]>;
  listActive(): Promise<SemanticMemoryRow[]>;
  listBySourceSessions(
    sessionIds: string[],
    opts?: { status?: "active" | "deprecated" | "all" },
  ): Promise<SemanticMemoryRow[]>;
  searchFts(query: string, opts?: { limit?: number; types?: string[] }): Promise<SemanticFtsHit[]>;
  search(opts: SemanticMemorySearchOpts): Promise<SemanticFtsHit[]>;
  /** Same filters as search (no limit/offset) */
  countSearch(opts: Omit<SemanticMemorySearchOpts, "limit" | "offset">): Promise<number>;
  findByContent(content: string): Promise<SemanticMemoryRow | null>;
}
