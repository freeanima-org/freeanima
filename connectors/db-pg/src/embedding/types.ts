export type EmbedTextFn = (text: string) => Promise<number[] | null>;
export type EmbedTextsFn = (texts: string[]) => Promise<(number[] | null)[]>;

export type EmbeddingJobKind = "message" | "semantic_memory";

export type EmbeddingPendingJob = {
  kind: EmbeddingJobKind;
  id: string;
  content: string;
};
