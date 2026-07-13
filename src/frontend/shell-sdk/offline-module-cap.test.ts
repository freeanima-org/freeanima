import { beforeEach, describe, expect, it } from "bun:test";

import {
  registerOfflineModule,
  registerOfflineModuleCap,
  resetOfflineModuleRegistryForTests,
} from "./offline-module-registry.ts";
import { getGlobalOutboxSummary } from "./offline-module-cap.ts";
import {
  enqueueOutboxOp,
  markOutboxOpStale,
  setOfflineOutboxBackendForTests,
  updateOutboxOpError,
} from "./offline-outbox.ts";
import type { RpcModuleAdapter } from "./offline-module-types.ts";

const stubAdapter: RpcModuleAdapter = {
  kind: "rpc",
  moduleId: "diary",
  ordering: "fifo",
  flushOp: async () => ({ status: "done" }),
  refreshAll: async () => {},
};

describe("getGlobalOutboxSummary", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    registerOfflineModule(stubAdapter);
    registerOfflineModuleCap("diary", { offlineWritable: true });
  });

  it("拆分 pending / failed / stale 计数", async () => {
    const scope = "scope-a";
    await enqueueOutboxOp(scope, {
      id: "pending",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await enqueueOutboxOp(scope, {
      id: "failed",
      moduleId: "diary",
      method: "diary.patch",
      payload: {},
      createdAt: "2026-01-02T00:00:00.000Z",
    });
    await updateOutboxOpError(scope, "failed", "boom");
    await enqueueOutboxOp(scope, {
      id: "stale",
      moduleId: "diary",
      method: "diary.append",
      payload: {},
      createdAt: "2026-01-03T00:00:00.000Z",
    });
    await markOutboxOpStale(scope, "stale");

    const summary = await getGlobalOutboxSummary(scope);
    expect(summary.pending).toBe(1);
    expect(summary.failed).toBe(1);
    expect(summary.stale).toBe(1);
    expect(summary.ops).toHaveLength(3);
  });
});
