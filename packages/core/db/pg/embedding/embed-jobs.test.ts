import { describe, expect, it } from "bun:test";

import { averageEmbeddings } from "./embed-jobs.ts";

describe("averageEmbeddings", () => {
  it("returns null for empty input", () => {
    expect(averageEmbeddings([])).toBeNull();
  });

  it("returns normalized single vector unchanged in direction", () => {
    const v = [3, 4];
    const out = averageEmbeddings([v])!;
    expect(out[0]).toBeCloseTo(0.6, 5);
    expect(out[1]).toBeCloseTo(0.8, 5);
  });

  it("averages multiple vectors then L2-normalizes", () => {
    const out = averageEmbeddings([
      [1, 0],
      [0, 1],
    ])!;
    expect(out[0]).toBeCloseTo(Math.SQRT1_2, 5);
    expect(out[1]).toBeCloseTo(Math.SQRT1_2, 5);
  });
});
