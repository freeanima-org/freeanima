import { describe, expect, test } from "bun:test";

import {
  readOfflineCache,
  resolveCacheScope,
  setSatelliteOfflineCacheBackendForTests,
  writeOfflineCache,
} from "./offline-cache.ts";

describe("satellite-sdk offline-cache", () => {
  test("read/write round-trip", async () => {
    setSatelliteOfflineCacheBackendForTests(new Map());
    const scope = resolveCacheScope("ws://127.0.0.1:2658/sap/v1");
    await writeOfflineCache(scope, "tasks", "lists", [{ id: 1 }]);
    expect(await readOfflineCache<{ id: number }[]>(scope, "tasks", "lists")).toEqual([{ id: 1 }]);
    setSatelliteOfflineCacheBackendForTests(null);
  });
});
