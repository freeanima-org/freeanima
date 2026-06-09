import type { ResolvedEmbeddingConfig } from "@freeanima/service-config";

import { createOpenAiClientFromParsed } from "./client.ts";

export type EmbedTextFn = (text: string) => Promise<number[] | null>;

/** OpenAI 兼容 /v1/embeddings 客户端（Ollama bge-m3 等） */
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
    if (vec.length !== cfg.dimensions) {
      throw new Error(`embedding 维度 ${vec.length} 与配置 ${cfg.dimensions} 不一致`);
    }
    return vec;
  };
}
