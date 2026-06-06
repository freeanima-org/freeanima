/** PG semantic_memory 行（life-memory / recall / remember 消费） */
export type SemanticMemoryRow = {
  id: string;
  type: string;
  pinned: boolean;
  content: string;
  created: string;
  updated: string;
};

/** PG semantic_memory.content_fts 命中行 */
export type SemanticFtsHit = SemanticMemoryRow & {
  rank: number;
};

/** 语义记忆持久化端口（Slice B — semantic_memory 表） */
export interface SemanticMemoryStorePort {
  create(row: {
    content: string;
    type?: string;
    pinned?: boolean;
    id?: string;
    created?: string;
    updated?: string;
  }): Promise<string>;
  get(id: string): Promise<SemanticMemoryRow | null>;
  update(row: { id: string; content?: string; type?: string; pinned?: boolean }): Promise<void>;
  delete(id: string): Promise<boolean>;
  count(): Promise<number>;
  listResident(topN?: number): Promise<SemanticMemoryRow[]>;
  listAll(): Promise<SemanticMemoryRow[]>;
  searchFts(query: string, opts?: { limit?: number; types?: string[] }): Promise<SemanticFtsHit[]>;
  findByContent(content: string): Promise<SemanticMemoryRow | null>;
}
