export type EmbedTextFn = (text: string) => Promise<number[] | null>;
export type EmbedTextsFn = (texts: string[]) => Promise<(number[] | null)[]>;

export type EmbeddingJobKind =
  | "message"
  | "semantic_memory"
  | "limbic_memory"
  | "autobiographical_memory";

export type EmbeddingPendingJob = {
  kind: EmbeddingJobKind;
  id: string;
  content: string;
};

/** Single API embed input derived from a job (full text or one chunk). */
export type EmbeddingEmbedUnit = {
  job: EmbeddingPendingJob;
  /** Text passed to the embedding API (may be a chunk). */
  text: string;
  chunkIndex?: number;
  chunkCount?: number;
};
