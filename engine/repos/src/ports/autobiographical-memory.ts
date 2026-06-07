import type {
  AutobiographicalSignificance,
  AutobiographicalStatus,
} from "@freeanima/engine-db/schema";

export type { AutobiographicalSignificance, AutobiographicalStatus };

/** PG autobiographical_memory 行 */
export type AutobiographicalMemoryRow = {
  id: string;
  title: string;
  content: string;
  significance: AutobiographicalSignificance;
  period_start: string | null;
  period_end: string | null;
  source_semantic_memory: string[];
  source_sessions: string[];
  status: AutobiographicalStatus;
  created: string;
  updated: string;
};

export type AutobiographicalMemoryCreateInput = {
  title: string;
  content: string;
  significance?: AutobiographicalSignificance;
  period_start?: string | null;
  period_end?: string | null;
  source_semantic_memory?: string[];
  source_sessions?: string[];
  id?: string;
};

export type AutobiographicalListOrder = "updated_desc" | "significance_desc";

/** 自传体记忆持久化端口（只追加；无 content update） */
export interface AutobiographicalMemoryStorePort {
  create(row: AutobiographicalMemoryCreateInput): Promise<string>;
  get(id: string): Promise<AutobiographicalMemoryRow | null>;
  /** 软废弃；正文不变 */
  deprecate(id: string): Promise<boolean>;
  count(opts?: { status?: AutobiographicalStatus }): Promise<number>;
  listActive(opts?: {
    limit?: number;
    order?: AutobiographicalListOrder;
  }): Promise<AutobiographicalMemoryRow[]>;
  listCreatedSince(iso: string, opts?: { limit?: number }): Promise<AutobiographicalMemoryRow[]>;
  listBySourceSemanticMemory(
    semanticMemoryIds: string[],
    opts?: { status?: AutobiographicalStatus },
  ): Promise<AutobiographicalMemoryRow[]>;
  listBySourceSessions(
    sessionIds: string[],
    opts?: { status?: AutobiographicalStatus },
  ): Promise<AutobiographicalMemoryRow[]>;
}
