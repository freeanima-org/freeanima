import { describe, expect, it } from "bun:test";

import { cosineDistance, runDbscan } from "./dbscan.ts";
import { partitionRowsByCluster } from "./batch.ts";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

function unit(x: number, y: number): number[] {
  const n = Math.hypot(x, y) || 1;
  return [x / n, y / n];
}

function fakeRow(id: number, content: string): SemanticMemoryRow {
  return {
    id,
    type: "world",
    pinned: false,
    content,
    source_conversations: [],
    observed_at: null,
    occurred_at: null,
    status: "active",
    reference_count: 0,
    created_at: new Date(0),
    updated_at: new Date(0),
    world_id: 1,
  };
}

describe("cosineDistance", () => {
  it("is ~0 for identical directions", () => {
    const a = unit(1, 0);
    expect(cosineDistance(a, a)).toBeLessThan(1e-9);
  });

  it("is ~1 for orthogonal", () => {
    expect(cosineDistance(unit(1, 0), unit(0, 1))).toBeCloseTo(1, 5);
  });
});

describe("runDbscan", () => {
  it("clusters two tight groups and marks distant noise", async () => {
    const points = [
      { id: 1, embedding: unit(1, 0.02) },
      { id: 2, embedding: unit(1, -0.02) },
      { id: 3, embedding: unit(1, 0) },
      { id: 4, embedding: unit(-1, 0.02) },
      { id: 5, embedding: unit(-1, -0.02) },
      { id: 6, embedding: unit(-1, 0) },
      { id: 7, embedding: unit(0, 1) }, // alone → noise with minPoints=3
    ];
    const result = await runDbscan(points, { eps: 0.15, minPoints: 3 });
    expect(result.clusterCount).toBe(2);
    expect(result.labels.get(7)).toBe(-1);
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

  it("handles empty input", async () => {
    const result = await runDbscan([], { eps: 0.3, minPoints: 3 });
    expect(result.clusterCount).toBe(0);
    expect(result.labels.size).toBe(0);
  });
});

describe("partitionRowsByCluster", () => {
  it("groups by cluster_id and keeps null separate", () => {
    const rows = [fakeRow(1, "a"), fakeRow(2, "b"), fakeRow(3, "c")];
    const map = new Map<number, number | null>([
      [1, 0],
      [2, 0],
      [3, null],
    ]);
    const batches = partitionRowsByCluster(rows, map, 1_000_000);
    expect(batches).toHaveLength(2);
    expect(batches[0]?.clusterId).toBe(0);
    expect(batches[0]?.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(batches[1]?.clusterId).toBeNull();
    expect(batches[1]?.rows.map((r) => r.id)).toEqual([3]);
  });

  it("splits oversized groups by maxBatchBytes", () => {
    const rows = [
      fakeRow(1, "x".repeat(200)),
      fakeRow(2, "y".repeat(200)),
      fakeRow(3, "z".repeat(200)),
    ];
    const map = new Map<number, number | null>([
      [1, 1],
      [2, 1],
      [3, 1],
    ]);
    const batches = partitionRowsByCluster(rows, map, 250);
    expect(batches.length).toBeGreaterThan(1);
    expect(batches.every((b) => b.clusterId === 1)).toBe(true);
    expect(batches.reduce((n, b) => n + b.rows.length, 0)).toBe(3);
  });
});
