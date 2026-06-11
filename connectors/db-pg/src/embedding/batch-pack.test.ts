import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FALLBACK_TOKENIZER_REPO } from "@freeanima/engine-tokenizer";
import { countTokens } from "@freeanima/engine-tokenizer";
import {
  bindModelToFallbackForTest,
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/engine-tokenizer/testing";

import { MAX_CHUNK_TOKENS, packEmbeddingJobs, TARGET_BATCH_TOKENS } from "./batch-pack.ts";
import type { EmbeddingPendingJob } from "./types.ts";

const TEST_MODEL = "test-embed-model";

function mockEncode(text: string): number[] {
  const len = text.trim().length;
  if (!len) return [];
  return Array.from({ length: len }, (_, i) => i + 1);
}

function job(id: string, content: string): EmbeddingPendingJob {
  return { kind: "semantic_memory", id, content };
}

function packTokenTotals(packs: ReturnType<typeof packEmbeddingJobs>, model: string): number[] {
  return packs.map((pack) => pack.reduce((sum, unit) => sum + countTokens(unit.text, model), 0));
}

beforeEach(async () => {
  setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, mockEncode);
  await ensureFallbackTokenizer();
  bindModelToFallbackForTest(TEST_MODEL);
});

afterEach(() => {
  resetTokenizerForTest();
});

describe("packEmbeddingJobs", () => {
  it("empty list returns empty", () => {
    expect(packEmbeddingJobs([], { model: TEST_MODEL })).toEqual([]);
  });

  it("packs small items dynamically until batch budget", () => {
    const unit = "a".repeat(Math.floor(TARGET_BATCH_TOKENS * 0.4));
    const jobs = [job("a", unit), job("b", unit)];
    const packs = packEmbeddingJobs(jobs, { model: TEST_MODEL });
    expect(packs.length).toBeGreaterThanOrEqual(1);
    expect(packs.flat()).toHaveLength(2);
    for (const total of packTokenTotals(packs, TEST_MODEL)) {
      expect(total).toBeLessThanOrEqual(TARGET_BATCH_TOKENS);
    }
  });

  it("starts new pack when adding next item would exceed batch budget", () => {
    const big = "a".repeat(Math.floor(TARGET_BATCH_TOKENS * 0.55));
    const small = "b".repeat(100);
    const packs = packEmbeddingJobs([job("1", big), job("2", big), job("3", small)], {
      model: TEST_MODEL,
    });
    expect(packs.length).toBeGreaterThanOrEqual(2);
    for (const total of packTokenTotals(packs, TEST_MODEL)) {
      expect(total).toBeLessThanOrEqual(TARGET_BATCH_TOKENS);
    }
  });

  it("above-threshold item is embedded alone", () => {
    const alone = "x".repeat(TARGET_BATCH_TOKENS + 500);
    const tokens = countTokens(alone, TEST_MODEL);
    expect(tokens).toBeGreaterThan(TARGET_BATCH_TOKENS);
    expect(tokens).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);

    const packs = packEmbeddingJobs([job("mid", alone), job("tiny", "ok")], {
      model: TEST_MODEL,
    });
    expect(packs[0]).toHaveLength(1);
    expect(packs[0]![0]!.job.id).toBe("mid");
  });

  it("oversized item is split into multiple units across packs", () => {
    const oversized = "x".repeat(Math.ceil(MAX_CHUNK_TOKENS * 1.5));
    const packs = packEmbeddingJobs([job("big", oversized), job("ok", "fine")], {
      model: TEST_MODEL,
    });
    const bigUnits = packs.flat().filter((u) => u.job.id === "big");
    expect(bigUnits.length).toBeGreaterThan(1);
    expect(bigUnits.every((u) => u.chunkCount === bigUnits.length)).toBe(true);
    expect(packs.flat().some((u) => u.job.id === "ok")).toBe(true);
  });

  it("each split unit stays within batch budget", () => {
    const huge = "z".repeat(MAX_CHUNK_TOKENS * 3);
    const packs = packEmbeddingJobs([job("huge", huge)], { model: TEST_MODEL });
    for (const unit of packs.flat()) {
      expect(countTokens(unit.text, TEST_MODEL)).toBeLessThanOrEqual(TARGET_BATCH_TOKENS);
    }
  });
});
