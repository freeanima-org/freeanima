import { describe, expect, it, vi } from "bun:test";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { createHook, walkHookChain } from "./hook";
import { HookRegistry } from "./registry";

type TestContext = {
  value: number;
};

const testHook = createHook<TestContext>("@freeanima/kernel-hooks/test/example", "测试 hook");

function newRegistry(): HookRegistry {
  return new HookRegistry(createLogger({ level: "debug", sinks: [createNullSink()] }));
}

describe("HookRegistry", () => {
  it("无 handler 时返回空链", async () => {
    const registry = newRegistry();
    const context = { value: 1 };
    const run = await registry.run(testHook, context);
    expect(run.context).toBe(context);
    expect(run.chain).toBeNull();
    expect(run.status).toBe("ok");
    expect(run.blocked).toBe(false);
    expect(run.blockedMessage).toBeUndefined();
  });

  it("run 按 priority 升序执行", async () => {
    const registry = newRegistry();
    const order: number[] = [];
    registry.on(
      testHook,
      () => {
        order.push(2);
        return { status: "ok" };
      },
      { priority: 200 },
    );
    registry.on(
      testHook,
      () => {
        order.push(1);
        return { status: "ok" };
      },
      { priority: 50 },
    );
    await registry.run(testHook, { value: 1 });
    expect(order).toEqual([1, 2]);
  });

  it("多 handler 时链头为最后一步 data", async () => {
    const registry = newRegistry();
    registry.on(testHook, () => ({
      status: "ok",
      data: { a: 1 },
    }));
    registry.on(testHook, () => ({
      status: "ok",
      data: { b: 2 },
    }));
    const run = await registry.run(testHook, { value: 0 });
    expect(run.chain?.data).toEqual({ b: 2 });
    expect(run.chain?.prev?.data).toEqual({ a: 1 });
  });

  it("ok 且 blocked 时中止后续 handler 并设置 blockedMessage", async () => {
    const registry = newRegistry();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, () => ({
      status: "ok",
      blocked: true,
      message: "stop",
    }));
    registry.on(testHook, second);
    const run = await registry.run(testHook, { value: 1 });
    expect(run.blocked).toBe(true);
    expect(run.blockedMessage).toBe("stop");
    expect(second).not.toHaveBeenCalled();
  });

  it("failed 不中止后续 handler", async () => {
    const registry = newRegistry();
    const order: string[] = [];
    registry.on(testHook, () => {
      order.push("fail");
      return { status: "failed", message: "oops" };
    });
    registry.on(testHook, () => {
      order.push("ok");
      return { status: "ok" };
    });
    const run = await registry.run(testHook, { value: 1 });
    expect(order).toEqual(["fail", "ok"]);
    expect(run.status).toBe("failed");
    expect(run.blocked).toBe(false);
    expect(walkHookChain(run.chain)).toHaveLength(2);
  });

  it("failed 步上的 blocked 被忽略且不短路", async () => {
    const registry = newRegistry();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, () => ({
      status: "failed",
      blocked: true,
      message: "ignored",
    }));
    registry.on(testHook, second);
    const run = await registry.run(testHook, { value: 1 });
    expect(second).toHaveBeenCalledTimes(1);
    expect(run.blocked).toBe(false);
  });

  it("prev 链：链头为最后执行的 handler", async () => {
    const registry = newRegistry();
    registry.on(testHook, () => ({ status: "ok", data: { n: 1 } }));
    registry.on(testHook, () => ({ status: "ok", data: { n: 2 } }));
    const run = await registry.run(testHook, { value: 0 });
    expect(run.chain?.data?.n).toBe(2);
    expect(run.chain?.prev?.data?.n).toBe(1);
  });

  it("handler 抛错时转为 failed 步且不向外 throw", async () => {
    const registry = newRegistry();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, () => {
      throw new Error("handler failed");
    });
    registry.on(testHook, second);
    const run = await registry.run(testHook, { value: 1 });
    expect(run.status).toBe("failed");
    expect(run.chain?.prev?.status).toBe("failed");
    expect(run.chain?.prev?.message).toBe("handler failed");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("handler 返回 void 视为 ok", async () => {
    const registry = newRegistry();
    registry.on(testHook, () => {});
    const run = await registry.run(testHook, { value: 1 });
    expect(run.chain?.status).toBe("ok");
    expect(run.status).toBe("ok");
  });

  it("blocked 无 message 时不设置 blockedMessage", async () => {
    const registry = newRegistry();
    registry.on(testHook, () => ({ status: "ok", blocked: true }));
    const run = await registry.run(testHook, { value: 1 });
    expect(run.blocked).toBe(true);
    expect(run.blockedMessage).toBeUndefined();
  });

  it("unregister 后不再执行", async () => {
    const registry = newRegistry();
    const handler = vi.fn(() => ({ status: "ok" as const }));
    const off = registry.on(testHook, handler);
    off();
    await registry.run(testHook, { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("unregister 只移除对应 handler", async () => {
    const registry = newRegistry();
    const removed = vi.fn(() => ({ status: "ok" as const }));
    const kept = vi.fn(() => ({ status: "ok" as const }));
    const off = registry.on(testHook, removed);
    registry.on(testHook, kept);
    off();
    await registry.run(testHook, { value: 1 });
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it("注销最后一个 handler 后 run 返回空链", async () => {
    const registry = newRegistry();
    const off = registry.on(testHook, () => ({ status: "ok" }));
    off();
    const run = await registry.run(testHook, { value: 1 });
    expect(run.chain).toBeNull();
  });

  it("重复 unregister 安全", async () => {
    const registry = newRegistry();
    const off = registry.on(testHook, () => ({ status: "ok" }));
    off();
    off();
    const run = await registry.run(testHook, { value: 1 });
    expect(run.chain).toBeNull();
  });

  it("存在其他 handler 时重复 unregister 不报错", async () => {
    const registry = newRegistry();
    const kept = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, kept);
    const off = registry.on(testHook, () => ({ status: "ok" }));
    off();
    off();
    await registry.run(testHook, { value: 1 });
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it("注销后可重新注册并执行", async () => {
    const registry = newRegistry();
    const first = vi.fn(() => ({ status: "ok" as const }));
    const off = registry.on(testHook, first);
    off();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, second);
    await registry.run(testHook, { value: 1 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("同一 handler 注册两次会执行两次", async () => {
    const registry = newRegistry();
    const handler = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, handler);
    registry.on(testHook, handler);
    await registry.run(testHook, { value: 1 });
    expect(handler).toHaveBeenCalledTimes(2);
  });
});
