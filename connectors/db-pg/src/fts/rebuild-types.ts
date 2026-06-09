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
  /** 仅处理 fts_segmented / content_embedding 仍为空的行（断点续跑） */
  onlyMissing?: boolean;
  onProgress?: (progress: FtsRebuildProgress) => void;
};
