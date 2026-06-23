export type FtsRebuildPhase =
  | "semantic_memory_segmented"
  | "messages_segmented"
  | "limbic_memory_segmented"
  | "autobiographical_memory_segmented"
  | "semantic_memory_embedding"
  | "messages_embedding"
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
};
