import { describe, expect, it } from "bun:test";

import type { SemanticFtsHit } from "@freeanima/core/db/schema/rows";

import { effectivePassiveRecallMinScore, meetsPassiveRecallMinScore } from "./score.ts";

function row(id: number, rank: number): SemanticFtsHit {
  return { id, rank } as SemanticFtsHit;
}

describe("passive recall score threshold", () => {
  it("uses max of absolute and relative thresholds", () => {
    const rows = [row(1, 0.04), row(2, 0.02)];
    expect(
      effectivePassiveRecallMinScore(rows, { min_score: 0.016, min_relative_score: 0.55 }),
    ).toBeCloseTo(0.022, 6);
  });

  it("filters weak tail relative to top hit", () => {
    const rows = [row(1, 0.04), row(2, 0.012), row(3, 0.022)];
    const min = effectivePassiveRecallMinScore(rows, {
      min_score: 0.016,
      min_relative_score: 0.55,
    });
    const kept = rows.filter((r) => meetsPassiveRecallMinScore(r.rank, min)).map((r) => r.id);
    expect(kept).toEqual([1, 3]);
  });

  it("returns absolute floor when top hit is weak", () => {
    const rows = [row(1, 0.01)];
    const min = effectivePassiveRecallMinScore(rows, {
      min_score: 0.016,
      min_relative_score: 0.55,
    });
    expect(meetsPassiveRecallMinScore(rows.at(0)?.rank ?? 0, min)).toBe(false);
  });
});
