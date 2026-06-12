import type {
  AutobiographicalSignificance,
  AutobiographicalStatus,
} from "@freeanima/storage-db/schema";

export type { AutobiographicalSignificance, AutobiographicalStatus };

/** PG autobiographical_memory row */
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

export type AutobiographicalListOpts = {
  query?: string;
  offset?: number;
  limit?: number;
  status?: AutobiographicalStatus;
  significance?: AutobiographicalSignificance;
  source_session?: string;
};

/** Autobiographical memory persistence port (append-only; no content update) */
export interface AutobiographicalMemoryStorePort {
  create(row: AutobiographicalMemoryCreateInput): Promise<string>;
  get(id: string): Promise<AutobiographicalMemoryRow | null>;
  /** Soft deprecate; body unchanged */
  deprecate(id: string): Promise<boolean>;
  count(opts?: Omit<AutobiographicalListOpts, "offset" | "limit">): Promise<number>;
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
  list(opts?: AutobiographicalListOpts): Promise<AutobiographicalMemoryRow[]>;
}
