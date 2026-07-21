import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

const realGate = await import("@freeanima/frontend/shell-sdk/habitat-fetch-gate");
const gateOriginal = {
  isHabitatFetchAvailable: realGate.isHabitatFetchAvailable,
  isNetworkOnline: realGate.isNetworkOnline,
  isHabitatConnected: realGate.isHabitatConnected,
  shellWritesDisabledFromState: realGate.shellWritesDisabledFromState,
};

const hubCall = mock(async (method: string, _payload: unknown) => {
  if (method === "diary.create") {
    return {
      item: {
        id: 42,
        title: "online",
        summary: "",
        entry_at: "2026-07-12T00:00:00.000Z",
        tags: [],
        blocks: [],
        created_at: "2026-07-12T00:00:00.000Z",
        updated_at: "2026-07-12T00:00:00.000Z",
      },
    };
  }
  throw new Error(`unexpected ${method}`);
});

mock.module("@freeanima/frontend/shell-sdk/habitat-fetch-gate", () => ({
  ...gateOriginal,
  isHabitatFetchAvailable: () => true,
}));

mock.module("@freeanima/platform/habitat/client.ts", () => ({
  getTypedHabitatClient: () => ({ call: hubCall }),
}));

afterAll(() => {
  mock.module("@freeanima/frontend/shell-sdk/habitat-fetch-gate", () => gateOriginal);
});

const { listOutboxOps, resolveOutboxScope, setOfflineOutboxBackendForTests } =
  await import("@freeanima/frontend/shell-sdk/offline-outbox");
const { setSatelliteOfflineCacheBackendForTests } =
  await import("@freeanima/frontend/shell-sdk/offline-cache");
const { resetOfflineModuleRegistryForTests } =
  await import("@freeanima/frontend/shell-sdk/offline-module-registry");
const { resetTempIdAllocatorForTests } =
  await import("@freeanima/frontend/shell-sdk/offline-temp-id");
const { offlineCreateDiaryEntry } = await import("./offline-store.ts");

describe("diary online write-through", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    setSatelliteOfflineCacheBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
    hubCall.mockClear();
  });

  it("Habitat 可用时 create 直连且不入 outbox", async () => {
    const created = await offlineCreateDiaryEntry("user", {
      title: "online",
      entry_at: "2026-07-12T00:00:00.000Z",
    });
    expect(created.id).toBe(42);
    expect(hubCall).toHaveBeenCalled();
    const ops = await listOutboxOps(resolveOutboxScope(), "diary");
    expect(ops).toHaveLength(0);
  });
});
