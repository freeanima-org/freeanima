/** PG semantic_memory 行（life-memory / recall / remember 消费） */
export type SemanticMemoryRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  source_sessions: string[];
  observed_at: string | null;
  occurred_at: string | null;
  status: string;
  created: string;
  updated: string;
};

/** PG semantic_memory.content_fts 命中行 */
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

/** 覆盖式更新：仅传入的字段会被修改；source_sessions 传 [] 可清空 */
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

export type SemanticMemorySearchOpts = {
  query?: string;
  limit?: number;
  types?: string[];
  status?: "active" | "deprecated" | "all";
  source_sessions?: string[];
};

/** 语义记忆持久化端口（Slice B — semantic_memory 表） */
export interface SemanticMemoryStorePort {
  create(row: SemanticMemoryCreateInput): Promise<string>;
  get(id: string): Promise<SemanticMemoryRow | null>;
  update(row: SemanticMemoryUpdateInput): Promise<void>;
  deprecate(id: string): Promise<boolean>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  listResident(topN?: number): Promise<SemanticMemoryRow[]>;
  listAll(): Promise<SemanticMemoryRow[]>;
  listBySourceSessions(
    sessionIds: string[],
    opts?: { status?: "active" | "deprecated" | "all" },
  ): Promise<SemanticMemoryRow[]>;
  searchFts(query: string, opts?: { limit?: number; types?: string[] }): Promise<SemanticFtsHit[]>;
  search(opts: SemanticMemorySearchOpts): Promise<SemanticFtsHit[]>;
  findByContent(content: string): Promise<SemanticMemoryRow | null>;
}
