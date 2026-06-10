export type FtsRebuildPhase =
  | "semantic_memory_segmented"
  | "messages_segmented"
  | "semantic_memory_embedding"
  | "messages_embedding";

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
