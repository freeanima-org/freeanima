import { describe, expect, test } from "bun:test";

import {
  formatOfflineCacheTime,
  readOfflineCache,
  readOfflineCacheEntry,
  resolveCacheScope,
  resolveHabitatCacheScope,
  setSatelliteOfflineCacheBackendForTests,
  writeOfflineCache,
} from "./offline-cache.ts";
import { resetSubjectScopeForTest, setSubjectKind } from "./subject-scope-store.ts";

describe("satellite-sdk offline-cache", () => {
  test("read/write round-trip with cachedAt envelope", async () => {
    setSatelliteOfflineCacheBackendForTests(new Map());
    const scope = resolveCacheScope("ws://127.0.0.1:2658/rpc/v1");
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
    map.set(`kv|${scope}|tasks|lists`, [{ id: 2 }]);
    const entry = await readOfflineCacheEntry<{ id: number }[]>(scope, "tasks", "lists");
    expect(entry?.data).toEqual([{ id: 2 }]);
    expect(entry?.cachedAt).toBeNull();
    setSatelliteOfflineCacheBackendForTests(null);
  });

  test("formatOfflineCacheTime", () => {
    const text = formatOfflineCacheTime(new Date("2026-07-01T12:00:00.000Z"), "en-US");
    expect(text.length).toBeGreaterThan(0);
  });

  test("resolveHabitatCacheScope includes subject kind", () => {
    resetSubjectScopeForTest();
    const prevWindow = globalThis.window;
    const shell = { habitatWsUrl: "ws://hub.example/rpc/v1" };
    globalThis.window = { satelliteShell: shell } as Window & typeof globalThis;
    try {
      expect(resolveHabitatCacheScope()).toBe("ws://hub.example/rpc/v1:user");
      setSubjectKind("agent");
      expect(resolveHabitatCacheScope()).toBe("ws://hub.example/rpc/v1:agent");
    } finally {
      globalThis.window = prevWindow;
      resetSubjectScopeForTest();
    }
  });

  test("user and agent offline cache are isolated", async () => {
    resetSubjectScopeForTest();
    setSatelliteOfflineCacheBackendForTests(new Map());
    const habitatScope = resolveCacheScope("ws://127.0.0.1:2658/rpc/v1");
    await writeOfflineCache(`${habitatScope}:user`, "tasks", "lists", [{ id: 1 }]);
    await writeOfflineCache(`${habitatScope}:agent`, "tasks", "lists", [{ id: 2 }]);
    expect(
      await readOfflineCache<{ id: number }[]>(`${habitatScope}:user`, "tasks", "lists"),
    ).toEqual([{ id: 1 }]);
    expect(
      await readOfflineCache<{ id: number }[]>(`${habitatScope}:agent`, "tasks", "lists"),
    ).toEqual([{ id: 2 }]);
    setSatelliteOfflineCacheBackendForTests(null);
    resetSubjectScopeForTest();
  });
});
