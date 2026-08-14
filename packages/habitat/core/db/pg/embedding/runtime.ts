import type { EmbedTextFn, EmbedTextsFn, EmbeddingJobKind } from "./types.ts";

let embedTextFn: EmbedTextFn | null = null;
let embedTextsFn: EmbedTextsFn | null = null;

export type AfterEmbeddingStoredFn = (info: {
  kind: EmbeddingJobKind;
  id: string;
  embedding: number[];
}) => void | Promise<void>;

let afterEmbeddingStoredFn: AfterEmbeddingStoredFn | null = null;

export function registerEmbedTextFn(fn: EmbedTextFn | null): void {
  embedTextFn = fn;
}

export function getEmbedTextFn(): EmbedTextFn | null {
  return embedTextFn;
}

export function registerEmbedTextsFn(fn: EmbedTextsFn | null): void {
  embedTextsFn = fn;
}

export function getEmbedTextsFn(): EmbedTextsFn | null {
  return embedTextsFn;
}

export function registerAfterEmbeddingStored(fn: AfterEmbeddingStoredFn | null): void {
  afterEmbeddingStoredFn = fn;
}

export function getAfterEmbeddingStored(): AfterEmbeddingStoredFn | null {
  return afterEmbeddingStoredFn;
}

/** Test teardown */
export function resetEmbedTextFnForTest(): void {
  embedTextFn = null;
}

export function resetEmbedTextsFnForTest(): void {
  embedTextsFn = null;
}

export function resetAfterEmbeddingStoredForTest(): void {
  afterEmbeddingStoredFn = null;
}
