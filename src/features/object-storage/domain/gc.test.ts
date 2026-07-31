import { describe, expect, it, mock } from "bun:test";

import { gcObjectBlobsAfterEntityPurge, type GcObjectBlobsDeps } from "./gc.ts";

type PurgeRow = {
  id: number;
  world_id: number;
  primary_component: string | null;
  body: unknown;
};

const CID_A = "a".repeat(32);
const CID_B = "b".repeat(32);

function objectFileRow(id: number, worldId: number, cid: string): PurgeRow {
  return {
    id,
    world_id: worldId,
    primary_component: "object_file",
    body: { cid, size: 1, mime_type: "application/octet-stream" },
  };
}

describe("gcObjectBlobsAfterEntityPurge", () => {
  it("deletes blob when no remaining refs", async () => {
    const deleted: Array<{ worldId: number; cid: string }> = [];
    const result = await gcObjectBlobsAfterEntityPurge([objectFileRow(1, 10, CID_A)], {
      countRefs: async () => 0,
      deleteBlob: async (worldId, cid) => {
        deleted.push({ worldId, cid });
      },
    } satisfies GcObjectBlobsDeps);
    expect(result).toEqual({
      candidates: 1,
      deleted: 1,
      skipped_referenced: 0,
      skipped_errors: 0,
    });
    expect(deleted).toEqual([{ worldId: 10, cid: CID_A }]);
  });

  it("skips when other object_file still references cid", async () => {
    const deleted: string[] = [];
    const result = await gcObjectBlobsAfterEntityPurge([objectFileRow(1, 10, CID_A)], {
      countRefs: async () => 1,
      deleteBlob: async (_w, cid) => {
        deleted.push(cid);
      },
    });
    expect(result.deleted).toBe(0);
    expect(result.skipped_referenced).toBe(1);
    expect(deleted).toEqual([]);
  });

  it("dedupes same world+cid across purged rows", async () => {
    let deleteCalls = 0;
    const result = await gcObjectBlobsAfterEntityPurge(
      [objectFileRow(1, 10, CID_A), objectFileRow(2, 10, CID_A)],
      {
        countRefs: async () => 0,
        deleteBlob: async () => {
          deleteCalls += 1;
        },
      },
    );
    expect(result.candidates).toBe(1);
    expect(result.deleted).toBe(1);
    expect(deleteCalls).toBe(1);
  });

  it("ignores non-object_file rows", async () => {
    const result = await gcObjectBlobsAfterEntityPurge(
      [
        {
          id: 3,
          world_id: 10,
          primary_component: "task_item",
          body: { list_id: 1 },
        },
      ],
      {
        countRefs: async () => {
          throw new Error("should not count");
        },
        deleteBlob: async () => {
          throw new Error("should not delete");
        },
      },
    );
    expect(result.candidates).toBe(0);
    expect(result.deleted).toBe(0);
  });

  it("continues after delete error", async () => {
    const errors: string[] = [];
    const deleted: string[] = [];
    const result = await gcObjectBlobsAfterEntityPurge(
      [objectFileRow(1, 10, CID_A), objectFileRow(2, 10, CID_B)],
      {
        countRefs: async () => 0,
        deleteBlob: async (_w, cid) => {
          if (cid === CID_A) throw new Error("s3 down");
          deleted.push(cid);
        },
        onError: (_w, cid) => {
          errors.push(cid);
        },
      },
    );
    expect(result.deleted).toBe(1);
    expect(result.skipped_errors).toBe(1);
    expect(errors).toEqual([CID_A]);
    expect(deleted).toEqual([CID_B]);
  });

  it("treats unconfigured store delete as success when deleteBlob resolves", async () => {
    const deleteBlob = mock(async () => {});
    const result = await gcObjectBlobsAfterEntityPurge([objectFileRow(1, 10, CID_A)], {
      countRefs: async () => 0,
      deleteBlob,
    });
    expect(result.deleted).toBe(1);
    expect(deleteBlob).toHaveBeenCalledTimes(1);
  });
});
