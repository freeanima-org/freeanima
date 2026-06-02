import { describe, expect, it, vi } from "vitest";
import { createHook } from "../../src/hook.js";
import { HookRegistry } from "../../src/registry.js";

type TestPayload = {
  value: number;
  label?: string;
};

const testHook = createHook<TestPayload>(
  "@freeanima/hooks/test/example",
  "测试 hook",
);

describe("HookRegistry", () => {
  it("无 handler 时 run 原样返回 payload", async () => {
    const registry = new HookRegistry();
    const payload = { value: 1 };
    const result = await registry.run(testHook, payload);
    expect(result).toBe(payload);
    expect(result.value).toBe(1);
  });

  it("run 按 priority 升序执行", async () => {
    const registry = new HookRegistry();
    const order: number[] = [];
    registry.on(
      testHook,
      () => {
        order.push(2);
      },
      { priority: 200 },
    );
    registry.on(
      testHook,
      () => {
        order.push(1);
      },
      { priority: 50 },
    );
    await registry.run(testHook, { value: 1 });
    expect(order).toEqual([1, 2]);
  });

  it("未指定 priority 时默认为 100", async () => {
    const registry = new HookRegistry();
    const order: number[] = [];
    registry.on(testHook, () => {
      order.push("default");
    });
    registry.on(
      testHook,
      () => {
        order.push("low");
      },
      { priority: 200 },
    );
    registry.on(
      testHook,
      () => {
        order.push("high");
      },
      { priority: 50 },
    );
    await registry.run(testHook, { value: 1 });
    expect(order).toEqual(["high", "default", "low"]);
  });

  it("相同 priority 按注册顺序执行", async () => {
    const registry = new HookRegistry();
    const order: number[] = [];
    registry.on(testHook, () => {
      order.push(1);
    }, { priority: 100 });
    registry.on(testHook, () => {
      order.push(2);
    }, { priority: 100 });
    registry.on(testHook, () => {
      order.push(3);
    }, { priority: 100 });
    await registry.run(testHook, { value: 1 });
    expect(order).toEqual([1, 2, 3]);
  });

  it("handler 可变更 payload", async () => {
    const registry = new HookRegistry();
    registry.on(testHook, (payload) => {
      payload.value = 42;
      payload.label = "mutated";
    });
    const result = await registry.run(testHook, { value: 1 });
    expect(result).toEqual({ value: 42, label: "mutated" });
  });

  it("多个 handler 依次变更同一 payload", async () => {
    const registry = new HookRegistry();
    registry.on(testHook, (payload) => {
      payload.value += 1;
    });
    registry.on(testHook, (payload) => {
      payload.value *= 2;
    });
    const result = await registry.run(testHook, { value: 1 });
    expect(result.value).toBe(4);
  });

  it("await 异步 handler", async () => {
    const registry = new HookRegistry();
    const order: string[] = [];
    registry.on(testHook, async (payload) => {
      await new Promise((r) => setTimeout(r, 10));
      order.push("first");
      payload.value = 1;
    });
    registry.on(testHook, async () => {
      order.push("second");
    });
    await registry.run(testHook, { value: 0 });
    expect(order).toEqual(["first", "second"]);
  });

  it("handler 抛错时 run 拒绝", async () => {
    const registry = new HookRegistry();
    registry.on(testHook, () => {
      throw new Error("handler failed");
    });
    await expect(registry.run(testHook, { value: 1 })).rejects.toThrow(
      "handler failed",
    );
  });

  it("异步 handler 抛错时 run 拒绝", async () => {
    const registry = new HookRegistry();
    registry.on(testHook, async () => {
      await Promise.resolve();
      throw new Error("async handler failed");
    });
    await expect(registry.run(testHook, { value: 1 })).rejects.toThrow(
      "async handler failed",
    );
  });

  it("unregister 后不再执行", async () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    const off = registry.on(testHook, handler);
    off();
    await registry.run(testHook, { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("unregister 只移除对应 handler", async () => {
    const registry = new HookRegistry();
    const removed = vi.fn();
    const kept = vi.fn();
    const off = registry.on(testHook, removed);
    registry.on(testHook, kept);
    off();
    await registry.run(testHook, { value: 1 });
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
  });

  it("重复 unregister 安全", async () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    const off = registry.on(testHook, handler);
    off();
    off();
    await registry.run(testHook, { value: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("存在其他 handler 时重复 unregister 不报错", async () => {
    const registry = new HookRegistry();
    const removed = vi.fn();
    const kept = vi.fn();
    registry.on(testHook, kept);
    const off = registry.on(testHook, removed);
    off();
    off();
    await registry.run(testHook, { value: 1 });
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledOnce();
  });

  it("同一 handler 注册两次会执行两次", async () => {
    const registry = new HookRegistry();
    const handler = vi.fn();
    registry.on(testHook, handler);
    registry.on(testHook, handler);
    await registry.run(testHook, { value: 1 });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("最后一个 handler 注销后可再次注册并执行", async () => {
    const registry = new HookRegistry();
    const first = vi.fn();
    const off = registry.on(testHook, first);
    off();
    const second = vi.fn();
    registry.on(testHook, second);
    await registry.run(testHook, { value: 1 });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledOnce();
  });

  it("不同 qualifiedId 的 hook 互不干扰", async () => {
    const hookA = createHook<{ n: number }>("@freeanima/hooks/test/a");
    const hookB = createHook<{ n: number }>("@freeanima/hooks/test/b");
    const registry = new HookRegistry();
    const onA = vi.fn();
    const onB = vi.fn();
    registry.on(hookA, onA);
    registry.on(hookB, onB);
    await registry.run(hookA, { n: 1 });
    expect(onA).toHaveBeenCalledOnce();
    expect(onB).not.toHaveBeenCalled();
  });

  it("不同 registry 实例互不影响", async () => {
    const registryA = new HookRegistry();
    const registryB = new HookRegistry();
    const handlerA = vi.fn();
    const handlerB = vi.fn();
    registryA.on(testHook, handlerA);
    registryB.on(testHook, handlerB);
    await registryA.run(testHook, { value: 1 });
    expect(handlerA).toHaveBeenCalledOnce();
    expect(handlerB).not.toHaveBeenCalled();
  });

  it("handler 收到 run 传入的 payload 引用", async () => {
    const registry = new HookRegistry();
    let received: TestPayload | undefined;
    registry.on(testHook, (payload) => {
      received = payload;
    });
    const payload = { value: 7 };
    await registry.run(testHook, payload);
    expect(received).toBe(payload);
  });
});
