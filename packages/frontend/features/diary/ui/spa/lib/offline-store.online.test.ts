import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import * as habitatFetchGate from "@freeanima/client/portal-sdk/habitat-fetch-gate";
import * as habitatTypedClient from "@freeanima/client/portal-sdk/habitat-typed-client.ts";
import {
  listOutboxOps,
  resolveOutboxScope,
  setOfflineOutboxBackendForTests,
} from "@freeanima/client/portal-sdk/offline-outbox";
import { setSatelliteOfflineCacheBackendForTests } from "@freeanima/client/portal-sdk/offline-cache";
import { resetOfflineModuleRegistryForTests } from "@freeanima/client/portal-sdk/offline-module-registry";
import { resetTempIdAllocatorForTests } from "@freeanima/client/portal-sdk/offline-temp-id";
import { resetTypedHabitatClientForTests } from "@freeanima/client/portal-sdk/habitat-typed-client.ts";

import { offlineCreateDiaryEntry } from "./offline-store.ts";

const hubCall = mock(async (method: string, _payload: unknown) => {
  if (method === "diary.create") {
    return {
      item: {
        id: 42,
        title: "online",
        summary: "",
        entry_at: "2026-07-12T00:00:00.000Z",
        tag_ids: [],
        blocks: [],
        created_at: "2026-07-12T00:00:00.000Z",
        updated_at: "2026-07-12T00:00:00.000Z",
      },
    };
  }
  throw new Error(`unexpected ${method}`);
});

describe("diary online write-through", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    setSatelliteOfflineCacheBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetTempIdAllocatorForTests();
    resetTypedHabitatClientForTests();
    hubCall.mockClear();
    spyOn(habitatFetchGate, "isHabitatFetchAvailable").mockReturnValue(true);
    spyOn(habitatTypedClient, "getTypedHabitatClient").mockReturnValue({
      call: hubCall,
    } as never);
  });

  afterEach(() => {
    mock.restore();
    resetTypedHabitatClientForTests();
  });

  it("Habitat 可用时 create 直连且不入 outbox", async () => {
    const created = await offlineCreateDiaryEntry(1, {
      title: "online",
      entry_at: "2026-07-12T00:00:00.000Z",
    });
    expect(created.id).toBe(42);
    expect(hubCall).toHaveBeenCalled();
    const ops = await listOutboxOps(resolveOutboxScope(), "diary");
    expect(ops).toHaveLength(0);
  });
});
