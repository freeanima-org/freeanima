import { afterEach, describe, expect, it } from "bun:test";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { cidFromBytes, objectStorageKey } from "./cid.ts";
import {
  createObjectStore,
  resetObjectStoreForTest,
  serverCacheObjectPath,
} from "./object-store.ts";

describe("object-storage cid", () => {
  it("blake3-128 is 32 hex chars", () => {
    const cid = cidFromBytes(new Uint8Array([1, 2, 3]));
    expect(cid).toMatch(/^[0-9a-f]{32}$/);
    expect(cid).toBe(cidFromBytes(new Uint8Array([1, 2, 3])));
  });

  it("different bytes → different cid", () => {
    expect(cidFromBytes(new Uint8Array([1]))).not.toBe(cidFromBytes(new Uint8Array([2])));
  });

  it("objectStorageKey shape", () => {
    expect(objectStorageKey(10, "a".repeat(32))).toBe(`world/10/b3/${"a".repeat(32)}`);
  });
});

describe("object-store without remote", () => {
  afterEach(() => {
    resetObjectStoreForTest();
  });

  it("put throws when object_storage not configured", async () => {
    const store = createObjectStore({});
    await expect(store.put(1, new Uint8Array([1]))).rejects.toThrow(/未配置/);
  });

  it("serverCacheObjectPath is under tmpdir/anima/objects", () => {
    const cid = "ab".repeat(16);
    expect(serverCacheObjectPath(cid)).toBe(
      join(tmpdir(), "anima", "objects", cid.slice(0, 2), cid),
    );
  });
});
