import { describe, expect, it, beforeEach } from "bun:test";
import { withOfflineCache } from "./offline-cache-first.ts";
import { setSatelliteOfflineCacheBackendForTests } from "./offline-cache.ts";

describe("offline-cache-first", () => {
  beforeEach(() => {
    setSatelliteOfflineCacheBackendForTests(new Map());
  });

  it("returns cached value when fetch fails", async () => {
    const scope = "test-scope";
    const { writeOfflineCache } = await import("./offline-cache.ts");
    await writeOfflineCache(scope, "ns", "id", { ok: true });

    const result = await withOfflineCache<{ ok: boolean }>({
      scope,
      namespace: "ns",
      id: "id",
      fetch: async () => {
        throw new Error("offline");
      },
    });
    expect(result.ok).toBe(true);
  });
});
