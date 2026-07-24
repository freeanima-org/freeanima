import type { ResolvedEmbeddingConfig } from "@freeanima/host/core/config";

import { createOpenAiClientFromParsed } from "./client.ts";

export type EmbedTextFn = (text: string) => Promise<number[] | null>;
export type EmbedTextsFn = (texts: string[]) => Promise<(number[] | null)[]>;

function assertEmbeddingDimensions(vec: number[], expected: number): void {
  if (vec.length !== expected) {
    throw new Error(`embedding dimension ${vec.length} does not match configured ${expected}`);
  }
}

/** OpenAI compatible /v1/embeddings client (Ollama bge-m3, etc.) */
export function createOpenAiEmbeddingClient(cfg: ResolvedEmbeddingConfig): EmbedTextFn {
  const client = createOpenAiClientFromParsed({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
  });

  return async (text: string): Promise<number[] | null> => {
    const trimmed = text.trim();
    if (!trimmed) return null;

    const res = await client.embeddings.create({
      model: cfg.model,
      input: trimmed,
    });
    const vec = res.data[0]?.embedding;
    if (!vec?.length) return null;
    assertEmbeddingDimensions(vec, cfg.dimensions);
    return vec;
  };
}

/** OpenAI compatible batch /v1/embeddings (input: string[]) */
export function createOpenAiEmbeddingBatchClient(cfg: ResolvedEmbeddingConfig): EmbedTextsFn {
  const client = createOpenAiClientFromParsed({
    apiKey: cfg.apiKey,
    baseUrl: cfg.baseUrl,
    timeoutMs: cfg.timeoutMs,
  });

  return async (texts: string[]): Promise<(number[] | null)[]> => {
    if (texts.length === 0) return [];

    const inputs: string[] = [];
    const sourceIndices: number[] = [];
    const result: (number[] | null)[] = texts.map(() => null);

    for (let i = 0; i < texts.length; i++) {
      const trimmed = texts[i]?.trim();
      if (!trimmed) continue;
      if (!trimmed) continue;
      inputs.push(trimmed);
      sourceIndices.push(i);
    }
    if (inputs.length === 0) return result;

    const res = await client.embeddings.create({
      model: cfg.model,
      input: inputs,
    });

    for (const item of res.data) {
      const inputIdx = item.index;
      if (inputIdx == null || inputIdx < 0 || inputIdx >= sourceIndices.length) continue;
      const vec = item.embedding;
      if (!vec?.length) continue;
      assertEmbeddingDimensions(vec, cfg.dimensions);
      const sourceIndex = sourceIndices[inputIdx];
      if (sourceIndex === undefined) continue;
      result[sourceIndex] = vec;
    }

    return result;
  };
}
