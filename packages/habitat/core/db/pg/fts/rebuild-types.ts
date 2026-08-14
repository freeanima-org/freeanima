export type FtsRebuildPhase =
  | "semantic_memory_segmented"
  | "messages_segmented"
  | "limbic_memory_segmented"
  | "autobiographical_memory_segmented"
  | "entities_segmented"
  | "semantic_memory_embedding"
  | "messages_embedding"
  | "entities_embedding"
  | "limbic_memory_embedding"
  | "autobiographical_memory_embedding";

export type FtsRebuildProgress = {
  phase: FtsRebuildPhase;
  table: string;
  current: number;
  total: number;
};

export type FtsRebuildOptions = {
  /** Only rows where fts_segmented / content_embedding still empty (resume checkpoint) */
  onlyMissing?: boolean;
  onProgress?: (progress: FtsRebuildProgress) => void;
  /** Embedding rebuild retries per row (default 3). */
  embedRetryAttempts?: number;
  /** Base delay ms between embedding retries; attempt N waits base*N (default 750). */
  embedRetryBaseMs?: number;
};
