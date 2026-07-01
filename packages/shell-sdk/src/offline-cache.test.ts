import { describe, expect, test } from "bun:test";

import {
  formatOfflineCacheTime,
  readOfflineCache,
  readOfflineCacheEntry,
  resolveCacheScope,
  setSatelliteOfflineCacheBackendForTests,
  writeOfflineCache,
} from "./offline-cache.ts";

describe("satellite-sdk offline-cache", () => {
  test("read/write round-trip with cachedAt envelope", async () => {
    setSatelliteOfflineCacheBackendForTests(new Map());
    const scope = resolveCacheScope("ws://127.0.0.1:2658/hub/rpc/v1");
    await writeOfflineCache(scope, "tasks", "lists", [{ id: 1 }]);
    expect(await readOfflineCache<{ id: number }[]>(scope, "tasks", "lists")).toEqual([{ id: 1 }]);
    const entry = await readOfflineCacheEntry<{ id: number }[]>(scope, "tasks", "lists");
    expect(entry?.data).toEqual([{ id: 1 }]);
    expect(entry?.cachedAt).toBeInstanceOf(Date);
    setSatelliteOfflineCacheBackendForTests(null);
  });

  test("read legacy raw value without envelope", async () => {
    const map = new Map<string, unknown>();
    setSatelliteOfflineCacheBackendForTests(map);
    const scope = resolveCacheScope("ws://127.0.0.1:2658/sap/v1");
    map.set(`${scope}|tasks|lists`, [{ id: 2 }]);
    const entry = await readOfflineCacheEntry<{ id: number }[]>(scope, "tasks", "lists");
    expect(entry?.data).toEqual([{ id: 2 }]);
    expect(entry?.cachedAt).toBeNull();
    setSatelliteOfflineCacheBackendForTests(null);
  });

  test("formatOfflineCacheTime", () => {
    const text = formatOfflineCacheTime(new Date("2026-07-01T12:00:00.000Z"), "en-US");
    expect(text.length).toBeGreaterThan(0);
  });
});
