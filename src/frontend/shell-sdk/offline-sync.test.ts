import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// 先捕获真实实现，mock 后在 afterAll 恢复，避免 mock.module 全局泄漏污染其他测试文件。
const realGate = await import("./hub-fetch-gate.ts");
const gateOriginal = {
  isHubFetchAvailable: realGate.isHubFetchAvailable,
  isNetworkOnline: realGate.isNetworkOnline,
  isHubConnected: realGate.isHubConnected,
  shellWritesDisabledFromState: realGate.shellWritesDisabledFromState,
};

mock.module("./hub-fetch-gate.ts", () => ({
  ...gateOriginal,
  isHubFetchAvailable: () => true,
}));

afterAll(() => {
  mock.module("./hub-fetch-gate.ts", () => gateOriginal);
});

const { flushOfflineModule } = await import("./offline-sync.ts");
const {
  enqueueOutboxOp,
  listOutboxOps,
  OFFLINE_OUTBOX_MAX_ATTEMPTS,
  setOfflineOutboxBackendForTests,
} = await import("./offline-outbox.ts");
const { registerOfflineModule, registerOfflineModuleCap, resetOfflineModuleRegistryForTests } =
  await import("./offline-module-registry.ts");
import type { RpcModuleAdapter } from "./offline-module-types.ts";

describe("flushOfflineModule attempts gate", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
  });

  it("达到 attempts 上限后自动 flush 跳过该 op", async () => {
    const flushOp = mock(async () => ({ status: "failed" as const, error: "nope" }));
    const adapter: RpcModuleAdapter = {
      kind: "rpc",
      moduleId: "diary",
      ordering: "fifo",
      flushOp,
      refreshAll: async () => {},
    };
    registerOfflineModule(adapter);
    registerOfflineModuleCap("diary", { offlineWritable: true });

    const scope = "scope-a";
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      attempts: OFFLINE_OUTBOX_MAX_ATTEMPTS,
      syncStatus: "failed",
      lastError: "previous",
    });

    await flushOfflineModule("diary", scope);
    expect(flushOp).not.toHaveBeenCalled();
  });

  it("forceRetry 可绕过 attempts 上限", async () => {
    const flushOp = mock(async () => ({ status: "done" as const }));
    const adapter: RpcModuleAdapter = {
      kind: "rpc",
      moduleId: "diary",
      ordering: "fifo",
      flushOp,
      refreshAll: async () => {},
    };
    registerOfflineModule(adapter);
    registerOfflineModuleCap("diary", { offlineWritable: true });

    const scope = "scope-a";
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
      attempts: OFFLINE_OUTBOX_MAX_ATTEMPTS,
      syncStatus: "failed",
      lastError: "previous",
    });

    await flushOfflineModule("diary", scope, { forceRetry: true });
    expect(flushOp).toHaveBeenCalledTimes(1);
  });

  it("flush 失败时递增 attempts", async () => {
    const adapter: RpcModuleAdapter = {
      kind: "rpc",
      moduleId: "diary",
      ordering: "fifo",
      flushOp: async () => ({ status: "failed", error: "rpc error" }),
      refreshAll: async () => {},
    };
    registerOfflineModule(adapter);
    registerOfflineModuleCap("diary", { offlineWritable: true });

    const scope = "scope-a";
    await enqueueOutboxOp(scope, {
      id: "op-1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    await flushOfflineModule("diary", scope);
    const ops = await listOutboxOps(scope, "diary");
    expect(ops[0]?.attempts).toBe(1);
    expect(ops[0]?.lastError).toBe("rpc error");
  });
});
