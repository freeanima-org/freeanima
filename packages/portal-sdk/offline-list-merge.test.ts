import { describe, expect, it } from "bun:test";

import {
  mergeServerRowsKeepingPendingTemps,
  preserveEmptyChildArrays,
} from "./offline-list-merge.ts";

type Block = { id: number; parent_id: number; content: string };
type Row = { id: number; blocks: Block[] };

describe("offline-list-merge", () => {
  it("preserveEmptyChildArrays keeps local blocks when server list is empty", () => {
    const local: Row = {
      id: 1,
      blocks: [{ id: 10, parent_id: 1, content: "cached" }],
    };
    const server: Row = { id: 1, blocks: [] };
    const merged = preserveEmptyChildArrays([server], new Map([[1, local]]));
    expect(merged[0]?.blocks).toHaveLength(1);
    expect(merged[0]?.blocks[0]?.content).toBe("cached");
  });

  it("mergeServerRowsKeepingPendingTemps prepends unmatched temps", () => {
    const server: Row[] = [{ id: 2, blocks: [] }];
    const local: Row[] = [
      { id: -1, blocks: [] },
      { id: 2, blocks: [] },
    ];
    const merged = mergeServerRowsKeepingPendingTemps(server, local, new Set([-1]), (rows) => rows);
    expect(merged.map((r) => r.id)).toEqual([-1, 2]);
  });
});
