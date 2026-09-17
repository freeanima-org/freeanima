import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { FALLBACK_TOKENIZER_REPO } from "@freeanima/core/tokenizer";
import { countTokens } from "@freeanima/core/tokenizer";
import {
  bindModelToFallbackForTest,
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/core/tokenizer/testing";

import { expandJobsToUnits, MAX_CHUNK_TOKENS, TARGET_BATCH_TOKENS } from "./batch-pack.ts";
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

beforeEach(async () => {
  setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, mockEncode);
  await ensureFallbackTokenizer();
  bindModelToFallbackForTest(TEST_MODEL);
});

afterEach(() => {
  resetTokenizerForTest();
});

describe("expandJobsToUnits", () => {
  it("empty list returns empty", () => {
    expect(expandJobsToUnits([], { model: TEST_MODEL })).toEqual([]);
  });

  it("each short job becomes one unit (no merging)", () => {
    const unit = "a".repeat(Math.floor(TARGET_BATCH_TOKENS * 0.4));
    const units = expandJobsToUnits([job("a", unit), job("b", unit)], { model: TEST_MODEL });
    expect(units).toHaveLength(2);
    expect(units.map((u) => u.job.id).toSorted()).toEqual(["a", "b"]);
    for (const u of units) {
      expect(u.chunkIndex).toBeUndefined();
    }
  });

  it("item above split budget is chunked", () => {
    const long = "x".repeat(TARGET_BATCH_TOKENS + 500);
    const tokens = countTokens(long, TEST_MODEL);
    expect(tokens).toBeGreaterThan(TARGET_BATCH_TOKENS);
    expect(tokens).toBeLessThanOrEqual(MAX_CHUNK_TOKENS);

    const units = expandJobsToUnits([job("mid", long), job("tiny", "ok")], {
      model: TEST_MODEL,
    });
    const midUnits = units.filter((u) => u.job.id === "mid");
    expect(midUnits.length).toBeGreaterThan(1);
    expect(units.some((u) => u.job.id === "tiny")).toBe(true);
  });

  it("oversized item is split into multiple units", () => {
    const oversized = "x".repeat(Math.ceil(MAX_CHUNK_TOKENS * 1.5));
    const units = expandJobsToUnits([job("big", oversized), job("ok", "fine")], {
      model: TEST_MODEL,
    });
    const bigUnits = units.filter((u) => u.job.id === "big");
    expect(bigUnits.length).toBeGreaterThan(1);
    expect(bigUnits.every((u) => u.chunkCount === bigUnits.length)).toBe(true);
    expect(units.some((u) => u.job.id === "ok")).toBe(true);
  });

  it("each split unit stays within split budget", () => {
    const huge = "z".repeat(MAX_CHUNK_TOKENS * 3);
    const units = expandJobsToUnits([job("huge", huge)], { model: TEST_MODEL });
    for (const unit of units) {
      expect(countTokens(unit.text, TEST_MODEL)).toBeLessThanOrEqual(TARGET_BATCH_TOKENS);
    }
  });

  it("chunked units keep full trimmed job.content (store keys by id, not chunk text)", () => {
    const raw = `  ${"word ".repeat(TARGET_BATCH_TOKENS + 200)}  `;
    const units = expandJobsToUnits([job("long", raw)], { model: TEST_MODEL });
    expect(units.length).toBeGreaterThan(1);
    const expected = raw.trim();
    for (const unit of units) {
      expect(unit.job.content).toBe(expected);
      expect(unit.text).not.toBe(expected);
    }
  });
});
