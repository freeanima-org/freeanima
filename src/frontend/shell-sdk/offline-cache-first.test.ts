import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const realGate = await import("./habitat-fetch-gate.ts");
const gateOriginal = {
  isHabitatFetchAvailable: realGate.isHabitatFetchAvailable,
  isNetworkOnline: realGate.isNetworkOnline,
  isHubConnected: realGate.isHubConnected,
  shellWritesDisabledFromState: realGate.shellWritesDisabledFromState,
};

let hubAvailable = true;

mock.module("./habitat-fetch-gate.ts", () => ({
  ...gateOriginal,
  isHabitatFetchAvailable: () => hubAvailable,
}));

afterAll(() => {
  mock.module("./habitat-fetch-gate.ts", () => gateOriginal);
});

const { withOfflineCache } = await import("./offline-cache-first.ts");
const { setSatelliteOfflineCacheBackendForTests, writeOfflineCache, readOfflineCache } =
  await import("./offline-cache.ts");

describe("offline-cache-first", () => {
  beforeEach(() => {
    setSatelliteOfflineCacheBackendForTests(new Map());
    hubAvailable = true;
  });

  it("Habitat 可用时优先 fetch，不因缓存命中短路", async () => {
    const scope = "test-scope";
    await writeOfflineCache(scope, "ns", "id", { ok: false, from: "cache" });

    let fetched = false;
    const result = await withOfflineCache<{ ok: boolean; from: string }>({
      scope,
      namespace: "ns",
      id: "id",
      fetch: async () => {
        fetched = true;
        return { ok: true, from: "hub" };
      },
    });
    expect(fetched).toBe(true);
    expect(result.from).toBe("hub");
    const cached = await readOfflineCache<{ from: string }>(scope, "ns", "id");
    expect(cached?.from).toBe("hub");
  });

  it("Hub fetch 失败时回退缓存", async () => {
    const scope = "test-scope";
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

  it("Hub 不可用时只读缓存", async () => {
    hubAvailable = false;
    const scope = "test-scope";
    await writeOfflineCache(scope, "ns", "id", { ok: true });

    let fetched = false;
    const result = await withOfflineCache<{ ok: boolean }>({
      scope,
      namespace: "ns",
      id: "id",
      fetch: async () => {
        fetched = true;
        return { ok: false };
      },
    });
    expect(fetched).toBe(false);
    expect(result.ok).toBe(true);
  });
});
