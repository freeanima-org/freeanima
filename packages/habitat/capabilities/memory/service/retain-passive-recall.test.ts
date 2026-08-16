import { describe, expect, test } from "bun:test";

import type { SemanticRecallHit } from "../recall-search.ts";
import {
  mergeHitsByScore,
  mergeRetainPassiveHits,
  splitRetainPassiveQuotas,
} from "./retain-passive-recall.ts";

function hit(id: number, score: number, content = `c${id}`): SemanticRecallHit {
  return {
    memory_type: "semantic",
    score,
    semantic_memory_id: id,
    type: "world",
    pinned: false,
    content,
    source_conversations: [],
    observed_at: null,
    occurred_at: null,
    status: "active",
  };
}

describe("retain-passive-recall quotas", () => {
  test("splitRetainPassiveQuotas halves when both sides present", () => {
    expect(splitRetainPassiveQuotas(5, true, true)).toEqual({ user: 3, assistant: 2 });
    expect(splitRetainPassiveQuotas(4, true, true)).toEqual({ user: 2, assistant: 2 });
  });

  test("splitRetainPassiveQuotas gives full limit to single side", () => {
    expect(splitRetainPassiveQuotas(5, true, false)).toEqual({ user: 5, assistant: 0 });
    expect(splitRetainPassiveQuotas(5, false, true)).toEqual({ user: 0, assistant: 5 });
  });
});

describe("retain-passive-recall merge", () => {
  test("mergeHitsByScore keeps higher score and excludes ids", () => {
    const out = mergeHitsByScore(
      [hit(1, 0.5), hit(1, 0.9), hit(2, 0.8), hit(3, 0.7)],
      new Set([3]),
      2,
    );
    expect(out.map((h) => h.semantic_memory_id)).toEqual([1, 2]);
    expect(out[0]?.score).toBe(0.9);
  });

  test("mergeRetainPassiveHits applies per-role quotas and cross-side dedupe", () => {
    const out = mergeRetainPassiveHits({
      userHits: [hit(1, 0.9), hit(2, 0.8), hit(3, 0.7)],
      assistantHits: [hit(2, 0.95), hit(4, 0.6), hit(5, 0.5)],
      excludeIds: new Set([3]),
      quotas: { user: 2, assistant: 2 },
    });
    expect(out.map((h) => h.semantic_memory_id)).toEqual([1, 2, 4, 5]);
  });
});
