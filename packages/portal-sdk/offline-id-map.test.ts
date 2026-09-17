import { beforeEach, describe, expect, it } from "bun:test";

import {
  getIdMapping,
  resetIdMappingListenersForTests,
  setIdMapping,
  setOfflineIdMapBackendForTests,
  subscribeIdMappings,
} from "./offline-id-map.ts";

describe("offline-id-map subscribe", () => {
  beforeEach(() => {
    setOfflineIdMapBackendForTests(new Map());
    resetIdMappingListenersForTests();
  });

  it("setIdMapping 后通知订阅者", async () => {
    const events: Array<{ tempId: number; serverId: number }> = [];
    const unsub = subscribeIdMappings((event) => {
      if (event.moduleId === "diary") {
        events.push({ tempId: event.tempId, serverId: event.serverId });
      }
    });

    await setIdMapping("scope", "diary", -1, 42);
    expect(await getIdMapping("scope", "diary", -1)).toBe(42);
    expect(events).toEqual([{ tempId: -1, serverId: 42 }]);
    unsub();
  });
});
