import { beforeEach, describe, expect, it } from "bun:test";

import { setIdMapping, setOfflineIdMapBackendForTests } from "./offline-id-map.ts";
import {
  allocateTempId,
  resetTempIdAllocatorForTests,
  seedTempIdAllocatorFromIdMap,
} from "./offline-temp-id.ts";

describe("offline-temp-id seed", () => {
  beforeEach(() => {
    setOfflineIdMapBackendForTests(new Map());
    resetTempIdAllocatorForTests();
  });

  it("从 id-map 推进 allocator，避免复用已映射的负 id", async () => {
    await setIdMapping("scope", "diary", -3, 100);
    await seedTempIdAllocatorFromIdMap("scope", "diary");
    expect(allocateTempId("scope", "diary")).toBe(-4);
  });

  it("无 id-map 时仍从 -1 起", async () => {
    await seedTempIdAllocatorFromIdMap("scope", "diary");
    expect(allocateTempId("scope", "diary")).toBe(-1);
  });
});
