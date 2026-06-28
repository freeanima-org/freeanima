import type { SemanticFtsHit, SemanticMemoryRow } from "../schemas/semantic-memory-row.ts";

/** Default resident memory slot count injected into system prompt */
export const RESIDENT_TOP_N = 20;

/** Max pinned memories included in resident context (excess triggers warn log) */
export const RESIDENT_PINNED_MAX = 40;

export type { SemanticFtsHit, SemanticMemoryRow };
export { semanticFtsHitSchema, semanticMemoryRowSchema } from "../schemas/semantic-memory-row.ts";

export type SemanticMemoryCreateInput = {
  content: string;
  type?: string;
  pinned?: boolean;
  id?: string;
  source_conversations?: string[];
  observed_at?: string | null;
  occurred_at?: string | null;
  status?: string;
  created?: string;
  updated?: string;
};

/** Overlay update: only passed fields change; source_conversations [] clears */
export type SemanticMemoryUpdateInput = {
  id: string;
  content?: string;
  type?: string;
  pinned?: boolean;
  source_conversations?: string[];
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
  source_conversations?: string[];
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
  listBySourceConversations(
    conversationIds: string[],
    opts?: { status?: "active" | "deprecated" | "all" },
  ): Promise<SemanticMemoryRow[]>;
  searchFts(query: string, opts?: { limit?: number; types?: string[] }): Promise<SemanticFtsHit[]>;
  search(opts: SemanticMemorySearchOpts): Promise<SemanticFtsHit[]>;
  /** Same filters as search (no limit/offset) */
  countSearch(opts: Omit<SemanticMemorySearchOpts, "limit" | "offset">): Promise<number>;
  findByContent(content: string): Promise<SemanticMemoryRow | null>;
}
