import { afterAll, afterEach, describe, expect, it, mock } from "bun:test";

import { OBJECT_FILE_COMPONENT } from "@freeanima/host/core/db/schema/entity";
import type { EntityRow } from "@freeanima/host/core/db/pg/entity";

import { cidFromBytes } from "./cid.ts";
import {
  bindObjectStore,
  resetObjectStoreForTest,
  type ObjectPutResult,
  type ObjectStore,
} from "./object-store.ts";

const createEntityMock = mock(async (_input: unknown): Promise<EntityRow> => {
  throw new Error("createEntity mock not configured");
});
const updateEntityMock = mock(async (_input: unknown): Promise<EntityRow | null> => null);
const getEntityMock = mock(async (_id: number): Promise<EntityRow | null> => null);

const realEntity = await import("@freeanima/host/core/db/pg/entity");
const entityOriginal = { ...realEntity };

mock.module("@freeanima/host/core/db/pg/entity", () => ({
  ...entityOriginal,
  createEntity: createEntityMock,
  updateEntity: updateEntityMock,
  getEntity: getEntityMock,
}));

afterAll(() => {
  mock.module("@freeanima/host/core/db/pg/entity", () => entityOriginal);
});

const { createObjectFile, updateObjectFile } = await import("./file-store.ts");

const CID_OLD = "1".repeat(32);
const CID_NEW = "2".repeat(32);

function objectFileEntity(partial: {
  id: number;
  world_id: number;
  title: string;
  cid: string;
  size?: number;
}): EntityRow {
  const now = new Date("2026-01-01T00:00:00.000Z");
  return {
    id: partial.id,
    type: "content",
    world_id: partial.world_id,
    components: [OBJECT_FILE_COMPONENT],
    primary_component: OBJECT_FILE_COMPONENT,
    title: partial.title,
    summary: "",
    content: "",
    body: {
      cid: partial.cid,
      size: partial.size ?? 3,
      mime_type: "application/octet-stream",
    },
    tag_ids: [],
    pinned: false,
    reference_count: 0,
    revisions: [],
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function memoryStore(): ObjectStore & {
  puts: ObjectPutResult[];
  deleted: Array<{ worldId: number; cid: string }>;
} {
  const blobs = new Map<string, Uint8Array>();
  const puts: ObjectPutResult[] = [];
  const deleted: Array<{ worldId: number; cid: string }> = [];
  return {
    puts,
    deleted,
    async put(worldId, bytes) {
      const cid = cidFromBytes(bytes);
      blobs.set(`${worldId}:${cid}`, bytes);
      const result = { cid, size: bytes.byteLength };
      puts.push(result);
      return result;
    },
    async get(worldId, cid) {
      const bytes = blobs.get(`${worldId}:${cid}`);
      if (!bytes) throw new Error("missing");
      return bytes;
    },
    async exists(worldId, cid) {
      return blobs.has(`${worldId}:${cid}`);
    },
    async delete(worldId, cid) {
      deleted.push({ worldId, cid });
      blobs.delete(`${worldId}:${cid}`);
    },
    async deleteWorldPrefix() {},
  };
}

describe("createObjectFile blob release", () => {
  afterEach(() => {
    resetObjectStoreForTest();
    createEntityMock.mockReset();
    updateEntityMock.mockReset();
    getEntityMock.mockReset();
  });

  it("releases put cid when createEntity fails", async () => {
    const store = memoryStore();
    bindObjectStore(store);
    const released: Array<{ worldId: number; cid: string }> = [];
    createEntityMock.mockImplementation(async () => {
      throw new Error("db down");
    });

    await expect(
      createObjectFile(
        { world_id: 7, title: "a.bin", bytes: new Uint8Array([1, 2, 3]) },
        {
          releaseBlob: async (worldId, cid) => {
            released.push({ worldId, cid });
          },
        },
      ),
    ).rejects.toThrow("db down");

    expect(store.puts).toHaveLength(1);
    expect(released).toEqual([{ worldId: 7, cid: store.puts[0]!.cid }]);
  });

  it("does not release when createEntity succeeds", async () => {
    const store = memoryStore();
    bindObjectStore(store);
    let releaseCalls = 0;
    createEntityMock.mockImplementation(async () =>
      objectFileEntity({ id: 1, world_id: 7, title: "a.bin", cid: "c".repeat(32), size: 3 }),
    );

    const row = await createObjectFile(
      { world_id: 7, title: "a.bin", bytes: new Uint8Array([1, 2, 3]) },
      {
        releaseBlob: async () => {
          releaseCalls += 1;
        },
      },
    );
    expect(row.id).toBe(1);
    expect(releaseCalls).toBe(0);
  });
});

describe("updateObjectFile blob release", () => {
  afterEach(() => {
    resetObjectStoreForTest();
    createEntityMock.mockReset();
    updateEntityMock.mockReset();
    getEntityMock.mockReset();
  });

  it("releases previous cid after successful byte update", async () => {
    const store = memoryStore();
    const released: Array<{ worldId: number; cid: string }> = [];
    getEntityMock.mockImplementation(async () =>
      objectFileEntity({ id: 9, world_id: 3, title: "x.bin", cid: CID_OLD }),
    );
    updateEntityMock.mockImplementation(async () =>
      objectFileEntity({ id: 9, world_id: 3, title: "x.bin", cid: CID_NEW, size: 2 }),
    );

    // Force put to return CID_NEW regardless of bytes (memory store uses blake3)
    const put = mock(async () => ({ cid: CID_NEW, size: 2 }));
    bindObjectStore({
      ...store,
      put,
    });

    const row = await updateObjectFile(
      { id: 9, bytes: new Uint8Array([9, 9]) },
      {
        releaseBlob: async (worldId, cid) => {
          released.push({ worldId, cid });
        },
      },
    );
    expect(row.cid).toBe(CID_NEW);
    expect(released).toEqual([{ worldId: 3, cid: CID_OLD }]);
  });

  it("skips release when cid unchanged", async () => {
    const store = memoryStore();
    let releaseCalls = 0;
    getEntityMock.mockImplementation(async () =>
      objectFileEntity({ id: 9, world_id: 3, title: "x.bin", cid: CID_OLD }),
    );
    updateEntityMock.mockImplementation(async () =>
      objectFileEntity({ id: 9, world_id: 3, title: "x.bin", cid: CID_OLD }),
    );
    bindObjectStore({
      ...store,
      put: async () => ({ cid: CID_OLD, size: 3 }),
    });

    await updateObjectFile(
      { id: 9, bytes: new Uint8Array([1, 2, 3]) },
      {
        releaseBlob: async () => {
          releaseCalls += 1;
        },
      },
    );
    expect(releaseCalls).toBe(0);
  });
});
