import { describe, expect, it } from "bun:test";

import {
  DEFAULT_MAX_BATCH_ITEMS,
  DEFAULT_MAX_BATCH_TOKENS,
  estimateEmbeddingTokens,
  MAX_SINGLE_EMBEDDING_TOKENS,
  packEmbeddingJobs,
} from "./batch-pack.ts";
import type { EmbeddingPendingJob } from "./types.ts";

function job(id: string, content: string): EmbeddingPendingJob {
  return { kind: "semantic_memory", id, content };
}

describe("estimateEmbeddingTokens", () => {
  it("空文本为 0", () => {
    expect(estimateEmbeddingTokens("")).toBe(0);
    expect(estimateEmbeddingTokens("   ")).toBe(0);
  });

  it("按 3.5 字符/token 粗估", () => {
    expect(estimateEmbeddingTokens("abcd")).toBe(2);
  });
});

describe("packEmbeddingJobs", () => {
  it("空列表返回空", () => {
    expect(packEmbeddingJobs([])).toEqual([]);
  });

  it("按 maxItems 切分", () => {
    const jobs = Array.from({ length: 5 }, (_, i) => job(`id-${i}`, `text-${i}`));
    const packs = packEmbeddingJobs(jobs, { maxItems: 2, maxTokens: DEFAULT_MAX_BATCH_TOKENS });
    expect(packs).toHaveLength(3);
    expect(packs[0]).toHaveLength(2);
    expect(packs[2]).toHaveLength(1);
  });

  it("按 maxTokens 切分", () => {
    const long = "a".repeat(Math.floor(DEFAULT_MAX_BATCH_TOKENS * 3.5));
    const packs = packEmbeddingJobs([job("a", long), job("b", "short")], {
      maxItems: DEFAULT_MAX_BATCH_ITEMS,
      maxTokens: DEFAULT_MAX_BATCH_TOKENS,
    });
    expect(packs).toHaveLength(2);
    expect(packs[0]).toHaveLength(1);
    expect(packs[1]).toHaveLength(1);
  });

  it("单条超过 8K token 时跳过", () => {
    const oversized = "x".repeat(Math.ceil(MAX_SINGLE_EMBEDDING_TOKENS * 3.5) + 10);
    const packs = packEmbeddingJobs([job("big", oversized), job("ok", "fine")]);
    expect(packs).toHaveLength(1);
    expect(packs[0]).toHaveLength(1);
    expect(packs[0]![0]!.id).toBe("ok");
  });
});
