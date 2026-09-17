import { describe, expect, it } from "bun:test";

import { runHdbscan } from "./hdbscan.ts";

function unit(x: number, y: number): number[] {
  const n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
}

describe("runHdbscan", () => {
  it("separates two tight groups with true-split only (default)", async () => {
    const points = [
      { id: 1, embedding: unit(1, 0.02) },
      { id: 2, embedding: unit(1, -0.02) },
      { id: 3, embedding: unit(1, 0) },
      { id: 4, embedding: unit(-1, 0.02) },
      { id: 5, embedding: unit(-1, -0.02) },
      { id: 6, embedding: unit(-1, 0) },
      { id: 7, embedding: unit(0, 1) },
    ];
    const result = await runHdbscan(points, { minClusterSize: 3, peelSmall: false });
    expect(result.clusterCount).toBeGreaterThanOrEqual(2);
    const c1 = result.labels.get(1);
    const c4 = result.labels.get(4);
    expect(c1).not.toBe(-1);
    expect(c4).not.toBe(-1);
    expect(c1).not.toBe(c4);
    expect(result.labels.get(2)).toBe(c1);
    expect(result.labels.get(3)).toBe(c1);
    expect(result.labels.get(5)).toBe(c4);
    expect(result.labels.get(6)).toBe(c4);
  });

  it("peelSmall marks far bridge as noise", async () => {
    const points = [
      { id: 1, embedding: unit(1, 0.02) },
      { id: 2, embedding: unit(1, -0.02) },
      { id: 3, embedding: unit(1, 0) },
      { id: 4, embedding: unit(-1, 0.02) },
      { id: 5, embedding: unit(-1, -0.02) },
      { id: 6, embedding: unit(-1, 0) },
      { id: 7, embedding: unit(0, 1) },
    ];
    const result = await runHdbscan(points, { minClusterSize: 3, peelSmall: true });
    expect(result.clusterCount).toBeGreaterThanOrEqual(2);
    expect(result.labels.get(7)).toBe(-1);
  });

  it("does not collapse two well-separated blobs into one giant cluster", async () => {
    const points: Array<{ id: number; embedding: number[] }> = [];
    let id = 1;
    for (let i = 0; i < 8; i++) {
      points.push({ id: id++, embedding: unit(1, 0.01 * (i - 4)) });
    }
    for (let i = 0; i < 8; i++) {
      points.push({ id: id++, embedding: unit(-1, 0.01 * (i - 4)) });
    }
    points.push({ id: id++, embedding: unit(0, 1) });
    points.push({ id: id++, embedding: unit(0, -1) });

    const result = await runHdbscan(points, { minClusterSize: 3 });
    expect(result.clusterCount).toBeGreaterThanOrEqual(2);
    const counts = new Map<number, number>();
    for (const [, lab] of result.labels) {
      if (lab < 0) continue;
      counts.set(lab, (counts.get(lab) ?? 0) + 1);
    }
    const sizes = [...counts.values()].toSorted((a, b) => b - a);
    const totalLabeled = sizes.reduce((a, b) => a + b, 0);
    expect(sizes[0] ?? 0).toBeLessThan(totalLabeled * 0.85);
  });

  it("handles empty input", async () => {
    const result = await runHdbscan([], { minClusterSize: 3 });
    expect(result.clusterCount).toBe(0);
    expect(result.labels.size).toBe(0);
  });
});
