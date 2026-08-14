/** Search corpus: physical document model (hydrate path differs). */
export type SearchResource = "entity" | "message";

/** Retrieval method (orthogonal to filters). */
export type SearchChannel = "fts" | "trgm" | "vector";

export type SearchFilters = {
  resource: SearchResource;
  world_id?: number;
  primary_component?: string;
  conversation_id?: string;
  include_deleted?: boolean;
  /** Semantic-memory body filters (entity join). */
  semantic_types?: string[];
  semantic_status?: "active" | "deprecated" | "all";
  source_conversations?: string[];
};

export type SearchDoc = {
  doc_key: string;
  resource: SearchResource;
  source_id: string;
  world_id?: number | null;
  primary_component?: string | null;
  conversation_id?: string | null;
  message_role?: string | null;
  deleted_at?: Date | null;
  title?: string;
  summary?: string;
  content?: string;
  /** Precomputed jieba text; null when disabled / failed. */
  fts_segmented?: string | null;
  /** When false, skip indexing (e.g. non user/assistant messages). */
  indexable?: boolean;
};

export type SearchQuery = {
  text: string;
  filters: SearchFilters;
  channels: SearchChannel[];
  limit?: number;
  fuse?: "rrf" | "none";
};

export type SearchHit = {
  doc_key: string;
  score: number;
  source_id: string;
  resource: SearchResource;
  channels_hit?: SearchChannel[];
  channel_scores?: Partial<Record<SearchChannel, number>>;
  snippet?: string;
};

export type SearchBackend = {
  readonly id: "pg_search_index" | "pg_business_scan";
  upsert(docs: SearchDoc[]): Promise<void>;
  delete(docKeys: string[]): Promise<void>;
  deleteByFilters?(filters: SearchFilters): Promise<void>;
  search(query: SearchQuery): Promise<SearchHit[]>;
  /** Rebuild index rows from docs (caller supplies projection stream). */
  rebuild?(docs: SearchDoc[]): Promise<number>;
  /** Channels this backend can serve. */
  supportedChannels(): SearchChannel[];
};

export type SearchReranker = {
  rerank(input: {
    text: string;
    hits: SearchHit[];
    top_k?: number;
  }): Promise<SearchHit[]> | SearchHit[];
};

export class UnsupportedSearchChannelError extends Error {
  override readonly name = "UnsupportedSearchChannelError";
  constructor(
    readonly backendId: string,
    readonly channels: SearchChannel[],
  ) {
    super(`Search backend ${backendId} does not support channel(s): ${channels.join(", ")}`);
  }
}
