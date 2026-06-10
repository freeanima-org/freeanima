import { describe, expect, it } from "bun:test";

import {
  estimateEmbeddingTokens,
  MAX_CHUNK_TOKENS,
  packEmbeddingJobs,
  splitTextByTokenLimit,
  TARGET_BATCH_TOKENS,
} from "./batch-pack.ts";
import type { EmbeddingPendingJob } from "./types.ts";

function job(id: string, content: string): EmbeddingPendingJob {
  return { kind: "semantic_memory", id, content };
}

function packTokenTotals(packs: ReturnType<typeof packEmbeddingJobs>): number[] {
  return packs.map((pack) =>
    pack.reduce((sum, unit) => sum + estimateEmbeddingTokens(unit.text), 0),
  );
}

describe("estimateEmbeddingTokens", () => {
  it("empty text is 0", () => {
    expect(estimateEmbeddingTokens("")).toBe(0);
    expect(estimateEmbeddingTokens("   ")).toBe(0);
  });

  it("rough estimate at 3.5 chars/token", () => {
    expect(estimateEmbeddingTokens("abcd")).toBe(2);
  });
});

describe("splitTextByTokenLimit", () => {
  it("short text stays single chunk", () => {
    expect(splitTextByTokenLimit("hello", TARGET_BATCH_TOKENS)).toEqual(["hello"]);
  });

  it("splits oversized text into ~6K-token chunks", () => {
    const long = "x".repeat(TARGET_BATCH_TOKENS * 3.5 * 2 + 100);
    const chunks = splitTextByTokenLimit(long, TARGET_BATCH_TOKENS);
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) {
      expect(estimateEmbeddingTokens(chunk)).toBeLessThanOrEqual(TARGET_BATCH_TOKENS);
    }
  });
});

describe("packEmbeddingJobs", () => {
  it("empty list returns empty", () => {
    expect(packEmbeddingJobs([])).toEqual([]);
  });

  it("packs small items dynamically until ~6K tokens", () => {
    const unit = "a".repeat(3500);
    const jobs = [job("a", unit), job("b", unit)];
    const packs = packEmbeddingJobs(jobs);
    expect(packs).toHaveLength(1);
    expect(packs[0]).toHaveLength(2);
    expect(packTokenTotals(packs)[0]).toBeLessThanOrEqual(TARGET_BATCH_TOKENS);
  });

  it("starts new pack when adding next item would exceed 6K", () => {
    const big = "a".repeat(Math.floor(TARGET_BATCH_TOKENS * 3.5 * 0.55));
    const small = "b".repeat(100);
    const packs = packEmbeddingJobs([job("1", big), job("2", big), job("3", small)]);
    expect(packs.length).toBeGreaterThanOrEqual(2);
    for (const total of packTokenTotals(packs)) {
      expect(total).toBeLessThanOrEqual(TARGET_BATCH_TOKENS);
    }
  });

  it("6K–8K item is embedded alone", () => {
    const alone = "x".repeat(Math.ceil((TARGET_BATCH_TOKENS + 500) * 3.5));
    const tokens = estimateEmbeddingTokens(alone);
    expect(tokens).toBeGreaterThan(TARGET_BATCH_TOKENS);
    expect(tokens).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);

    const packs = packEmbeddingJobs([job("mid", alone), job("tiny", "ok")]);
    expect(packs[0]).toHaveLength(1);
    expect(packs[0]![0]!.job.id).toBe("mid");
  });

  it(">8K item is split into multiple units across packs", () => {
    const oversized = "x".repeat(Math.ceil(MAX_CHUNK_TOKENS * 3.5 * 1.5));
    const packs = packEmbeddingJobs([job("big", oversized), job("ok", "fine")]);
    const bigUnits = packs.flat().filter((u) => u.job.id === "big");
    expect(bigUnits.length).toBeGreaterThan(1);
    expect(bigUnits.every((u) => u.chunkCount === bigUnits.length)).toBe(true);
    expect(packs.flat().some((u) => u.job.id === "ok")).toBe(true);
  });

  it("each unit text stays within 8K token limit after split", () => {
    const huge = "z".repeat(Math.ceil(MAX_CHUNK_TOKENS * 3.5 * 3));
    const packs = packEmbeddingJobs([job("huge", huge)]);
    for (const unit of packs.flat()) {
      expect(estimateEmbeddingTokens(unit.text)).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);
    }
  });
});
