import { describe, expect, it } from "bun:test";

import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import {
  expandClusterBatchWithNeighbors,
  filterDeprecatedBatchRows,
  MAX_REFLECT_NEIGHBORS,
  type ClusterBatch,
} from "./batch.ts";

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

function makeBatch(clusterId: number | null, rows: SemanticMemoryRow[]): ClusterBatch {
  const bytes = rows.reduce((sum, row) => {
    const approx = JSON.stringify({
      id: row.id,
      type: row.type,
      content: row.content,
      source_conversations: row.source_conversations,
    });
    return sum + Buffer.byteLength(approx, "utf-8");
  }, 0);
  return { clusterId, rows, bytes };
}

const axisX = unit(1, 0);
const nearX = unit(1, 0.05);
const farY = unit(0, 1);

describe("expandClusterBatchWithNeighbors", () => {
  it("pulls a cross-cluster neighbor within eps", () => {
    const member = fakeRow(1, "tiger");
    const neighbor = fakeRow(2, "goat");
    const outsider = fakeRow(3, "spicy");
    const batch = makeBatch(0, [member]);
    const expanded = expandClusterBatchWithNeighbors(
      batch,
      [member, neighbor, outsider],
      [
        { entityId: 1, embedding: axisX },
        { entityId: 2, embedding: nearX },
        { entityId: 3, embedding: farY },
      ],
      { eps: 0.35, maxBatchBytes: 1_000_000 },
    );
    expect(expanded.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(expanded.bytes).toBeGreaterThan(batch.bytes);
  });

  it("rejects neighbors farther than eps", () => {
    const member = fakeRow(1, "a");
    const far = fakeRow(2, "b");
    const batch = makeBatch(0, [member]);
    const expanded = expandClusterBatchWithNeighbors(
      batch,
      [member, far],
      [
        { entityId: 1, embedding: axisX },
        { entityId: 2, embedding: farY },
      ],
      { eps: 0.35, maxBatchBytes: 1_000_000 },
    );
    expect(expanded).toBe(batch);
    expect(expanded.rows.map((r) => r.id)).toEqual([1]);
  });

  it("does not expand a NULL cluster", () => {
    const member = fakeRow(1, "noise");
    const neighbor = fakeRow(2, "near");
    const batch = makeBatch(null, [member]);
    const expanded = expandClusterBatchWithNeighbors(
      batch,
      [member, neighbor],
      [
        { entityId: 1, embedding: axisX },
        { entityId: 2, embedding: nearX },
      ],
      { eps: 0.35, maxBatchBytes: 1_000_000 },
    );
    expect(expanded).toBe(batch);
  });

  it("does not duplicate ids already in the batch", () => {
    const a = fakeRow(1, "a");
    const b = fakeRow(2, "b");
    const batch = makeBatch(0, [a, b]);
    const expanded = expandClusterBatchWithNeighbors(
      batch,
      [a, b],
      [
        { entityId: 1, embedding: axisX },
        { entityId: 2, embedding: nearX },
      ],
      { eps: 0.35, maxBatchBytes: 1_000_000 },
    );
    expect(expanded.rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("caps neighbors by maxNeighbors and keeps closer first", () => {
    const member = fakeRow(1, "core");
    const closer = fakeRow(2, "closer");
    const farther = fakeRow(3, "farther");
    const batch = makeBatch(0, [member]);
    const expanded = expandClusterBatchWithNeighbors(
      batch,
      [member, closer, farther],
      [
        { entityId: 1, embedding: axisX },
        { entityId: 2, embedding: unit(1, 0.02) },
        { entityId: 3, embedding: unit(1, 0.08) },
      ],
      { eps: 0.35, maxBatchBytes: 1_000_000, maxNeighbors: 1 },
    );
    expect(expanded.rows.map((r) => r.id)).toEqual([1, 2]);
  });

  it("stops adding neighbors when maxBatchBytes would be exceeded", () => {
    const member = fakeRow(1, "core");
    const bulky = fakeRow(2, "x".repeat(400));
    const batch = makeBatch(0, [member]);
    const expanded = expandClusterBatchWithNeighbors(
      batch,
      [member, bulky],
      [
        { entityId: 1, embedding: axisX },
        { entityId: 2, embedding: nearX },
      ],
      { eps: 0.35, maxBatchBytes: batch.bytes + 50 },
    );
    expect(expanded.rows.map((r) => r.id)).toEqual([1]);
  });

  it("keeps members without embeddings and does not pull from them", () => {
    const noVec = fakeRow(1, "no-vec");
    const neighbor = fakeRow(2, "near");
    const batch = makeBatch(0, [noVec]);
    const expanded = expandClusterBatchWithNeighbors(
      batch,
      [noVec, neighbor],
      [{ entityId: 2, embedding: nearX }],
      { eps: 0.35, maxBatchBytes: 1_000_000 },
    );
    expect(expanded).toBe(batch);
    expect(expanded.rows.map((r) => r.id)).toEqual([1]);
  });

  it("defaults maxNeighbors to MAX_REFLECT_NEIGHBORS", () => {
    const member = fakeRow(1, "core");
    const extras = Array.from({ length: MAX_REFLECT_NEIGHBORS + 3 }, (_, i) =>
      fakeRow(i + 2, `n${i}`),
    );
    const batch = makeBatch(0, [member]);
    const embeddings = [
      { entityId: 1, embedding: axisX },
      ...extras.map((row) => ({ entityId: row.id, embedding: nearX })),
    ];
    const expanded = expandClusterBatchWithNeighbors(batch, [member, ...extras], embeddings, {
      eps: 0.35,
      maxBatchBytes: 1_000_000,
    });
    expect(expanded.rows).toHaveLength(1 + MAX_REFLECT_NEIGHBORS);
  });
});

describe("filterDeprecatedBatchRows", () => {
  it("drops ids already deprecated earlier in the same reflect run", () => {
    const rows = [fakeRow(1, "a"), fakeRow(2, "b"), fakeRow(3, "c")];
    expect(filterDeprecatedBatchRows(rows, ["2"]).map((r) => r.id)).toEqual([1, 3]);
  });

  it("returns a copy when nothing is deprecated", () => {
    const rows = [fakeRow(1, "a")];
    const filtered = filterDeprecatedBatchRows(rows, []);
    expect(filtered).toEqual(rows);
    expect(filtered).not.toBe(rows);
  });
});
