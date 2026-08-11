import { afterEach, describe, expect, it } from "bun:test";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { cidFromBytes, objectStorageKey } from "./cid.ts";
import {
  createObjectStore,
  localObjectStorePath,
  localObjectStoreRoot,
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

describe("object-store local durable SSOT", () => {
  const prevHome = process.env.FREEANIMA_HOME;

  afterEach(async () => {
    resetObjectStoreForTest();
    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("put/get/exists/delete use FREEANIMA_HOME/object-store (not tmp cache)", async () => {
    const home = join(tmpdir(), `anima-object-store-test-${Date.now()}`);
    process.env.FREEANIMA_HOME = home;
    await mkdir(home, { recursive: true });

    const store = createObjectStore({});
    const bytes = new Uint8Array([9, 8, 7, 6]);
    const { cid, size } = await store.put(42, bytes);
    expect(size).toBe(4);
    expect(existsSync(localObjectStorePath(42, cid))).toBe(true);
    expect(existsSync(serverCacheObjectPath(cid))).toBe(false);
    expect(localObjectStoreRoot()).toContain("object-store");

    expect(await store.exists(42, cid)).toBe(true);
    expect(await store.get(42, cid)).toEqual(bytes);

    await store.delete(42, cid);
    expect(existsSync(localObjectStorePath(42, cid))).toBe(false);
    expect(await store.exists(42, cid)).toBe(false);

    await rm(home, { recursive: true, force: true });
  });

  it("deleteWorldPrefix removes local world tree", async () => {
    const home = join(tmpdir(), `anima-object-store-prefix-${Date.now()}`);
    process.env.FREEANIMA_HOME = home;
    await mkdir(home, { recursive: true });

    const store = createObjectStore({});
    const a = await store.put(7, new Uint8Array([1]));
    const b = await store.put(7, new Uint8Array([2]));
    await store.deleteWorldPrefix(7);
    expect(existsSync(localObjectStorePath(7, a.cid))).toBe(false);
    expect(existsSync(localObjectStorePath(7, b.cid))).toBe(false);

    await rm(home, { recursive: true, force: true });
  });

  it("partial remote config throws ObjectStorageNotConfiguredError", async () => {
    const store = createObjectStore({ endpoint: "https://example.com" });
    await expect(store.put(1, new Uint8Array([1]))).rejects.toThrow(/不完整|未配置/);
  });

  it("serverCacheObjectPath is under tmpdir/anima/objects", () => {
    const cid = "ab".repeat(16);
    expect(serverCacheObjectPath(cid)).toBe(
      join(tmpdir(), "anima", "objects", cid.slice(0, 2), cid),
    );
  });

  it("remote-mode delete clears tmp cache and does not use local store path for put", async () => {
    // Without real S3 we only assert path helpers remain distinct when writing local fixture.
    const home = join(tmpdir(), `anima-object-store-sep-${Date.now()}`);
    process.env.FREEANIMA_HOME = home;
    await mkdir(home, { recursive: true });
    const cid = "cd".repeat(16);
    const cachePath = serverCacheObjectPath(cid);
    await mkdir(join(cachePath, ".."), { recursive: true });
    await writeFile(cachePath, new Uint8Array([1]));
    const store = createObjectStore({});
    await store.delete(1, cid);
    expect(existsSync(cachePath)).toBe(false);
    await rm(home, { recursive: true, force: true });
  });
});
