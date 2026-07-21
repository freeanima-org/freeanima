import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

// 先捕获真实实现，mock 后在 afterAll 恢复，避免 mock.module 全局泄漏污染其他测试文件。
const realGate = await import("./habitat-fetch-gate.ts");
const gateOriginal = {
  isHabitatFetchAvailable: realGate.isHabitatFetchAvailable,
  isNetworkOnline: realGate.isNetworkOnline,
  isHabitatConnected: realGate.isHabitatConnected,
  shellWritesDisabledFromState: realGate.shellWritesDisabledFromState,
};

mock.module("./habitat-fetch-gate.ts", () => ({
  ...gateOriginal,
  isHabitatFetchAvailable: () => true,
}));

afterAll(() => {
  mock.module("./habitat-fetch-gate.ts", () => gateOriginal);
});

const { flushOfflineModule, resetOfflineSyncStateForTests } = await import("./offline-sync.ts");
const {
  enqueueOutboxOp,
  listOutboxOps,
  OFFLINE_OUTBOX_MAX_ATTEMPTS,
  setOfflineOutboxBackendForTests,
} = await import("./offline-outbox.ts");
const { registerOfflineModule, registerOfflineModuleCap, resetOfflineModuleRegistryForTests } =
  await import("./offline-module-registry.ts");
import type { RpcModuleAdapter } from "./offline-module-types.ts";
import type { OfflineOutboxOp } from "./offline-outbox.ts";

describe("flushOfflineModule attempts gate", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetOfflineSyncStateForTests();
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

describe("flushOfflineModule compact + 尾触发", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetOfflineSyncStateForTests();
  });

  it("compact 吸收的 op 会从 IDB 删除", async () => {
    const flushOp = mock(async () => ({ status: "done" as const }));
    const adapter: RpcModuleAdapter = {
      kind: "rpc",
      moduleId: "diary",
      ordering: "fifo",
      compactOutbox: (ops) => ops.filter((op) => op.id === "create-1"),
      flushOp,
      refreshAll: async () => {},
    };
    registerOfflineModule(adapter);
    registerOfflineModuleCap("diary", { offlineWritable: true });

    const scope = "scope-compact";
    await enqueueOutboxOp(scope, {
      id: "create-1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await enqueueOutboxOp(scope, {
      id: "patch-1",
      moduleId: "diary",
      method: "diary.patch",
      payload: { id: -1 },
      createdAt: "2026-01-01T00:00:01.000Z",
    });

    await flushOfflineModule("diary", scope);
    const remaining = await listOutboxOps(scope, "diary");
    expect(remaining).toEqual([]);
    expect(flushOp).toHaveBeenCalledTimes(1);
  });

  it("flush 进行中 enqueue 的 op 会在结束后再 flush", async () => {
    const scope = "scope-rerun";
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let flushCount = 0;
    const seenMethods: string[] = [];

    const adapter: RpcModuleAdapter = {
      kind: "rpc",
      moduleId: "diary",
      ordering: "fifo",
      flushOp: async (op) => {
        flushCount += 1;
        seenMethods.push(op.method);
        if (flushCount === 1) {
          await enqueueOutboxOp(scope, {
            id: "patch-late",
            moduleId: "diary",
            method: "diary.patch",
            payload: { id: 1 },
            createdAt: "2026-01-01T00:00:02.000Z",
          });
          void flushOfflineModule("diary", scope);
          await gate;
        }
        return { status: "done" };
      },
      refreshAll: async () => {},
    };
    registerOfflineModule(adapter);
    registerOfflineModuleCap("diary", { offlineWritable: true });

    await enqueueOutboxOp(scope, {
      id: "create-1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });

    const flushPromise = flushOfflineModule("diary", scope);
    await Promise.resolve();
    release();
    await flushPromise;

    expect(seenMethods).toEqual(["diary.create", "diary.patch"]);
    expect(await listOutboxOps(scope, "diary")).toEqual([]);
  });
});

describe("compactDiaryOutbox absorbed ids via sync diff", () => {
  beforeEach(() => {
    setOfflineOutboxBackendForTests(new Map());
    resetOfflineModuleRegistryForTests();
    resetOfflineSyncStateForTests();
  });

  it("仅保留 compact 结果中的 op id", async () => {
    function compactKeepCreate(ops: OfflineOutboxOp[]): OfflineOutboxOp[] {
      const create = ops.find((op) => op.method === "diary.create");
      return create ? [create] : [];
    }

    const adapter: RpcModuleAdapter = {
      kind: "rpc",
      moduleId: "diary",
      ordering: "fifo",
      compactOutbox: compactKeepCreate,
      flushOp: async () => ({ status: "done" }),
      refreshAll: async () => {},
    };
    registerOfflineModule(adapter);

    const scope = "scope-diff";
    await enqueueOutboxOp(scope, {
      id: "c1",
      moduleId: "diary",
      method: "diary.create",
      payload: {},
      createdAt: "2026-01-01T00:00:00.000Z",
    });
    await enqueueOutboxOp(scope, {
      id: "a1",
      moduleId: "diary",
      method: "diary.append",
      payload: { id: -1, content: "x" },
      createdAt: "2026-01-01T00:00:01.000Z",
    });

    await flushOfflineModule("diary", scope);
    expect(await listOutboxOps(scope, "diary")).toEqual([]);
  });
});
