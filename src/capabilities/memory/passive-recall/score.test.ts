import { describe, expect, it } from "bun:test";

import type { SemanticFtsHit } from "@freeanima/core/db/schema/rows";

import { effectivePassiveRecallMinScore, meetsPassiveRecallMinScore } from "./score.ts";

function row(id: string, rank: number): SemanticFtsHit {
  return { id, rank } as SemanticFtsHit;
}

describe("passive recall score threshold", () => {
  it("uses max of absolute and relative thresholds", () => {
    const rows = [row("a", 0.04), row("b", 0.02)];
    expect(
      effectivePassiveRecallMinScore(rows, { min_score: 0.016, min_relative_score: 0.55 }),
    ).toBeCloseTo(0.022, 6);
  });

  it("filters weak tail relative to top hit", () => {
    const rows = [row("strong", 0.04), row("weak", 0.012), row("mid", 0.022)];
    const min = effectivePassiveRecallMinScore(rows, {
      min_score: 0.016,
      min_relative_score: 0.55,
    });
    const kept = rows.filter((r) => meetsPassiveRecallMinScore(r.rank, min)).map((r) => r.id);
    expect(kept).toEqual(["strong", "mid"]);
  });

  it("returns absolute floor when top hit is weak", () => {
    const rows = [row("weak", 0.01)];
    const min = effectivePassiveRecallMinScore(rows, {
      min_score: 0.016,
      min_relative_score: 0.55,
    });
    expect(meetsPassiveRecallMinScore(rows.at(0)?.rank ?? 0, min)).toBe(false);
  });
});
