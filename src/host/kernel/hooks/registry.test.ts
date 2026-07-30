import { describe, expect, it, vi } from "bun:test";
import { createHook, walkHookChain } from "./hook.ts";
import { HookRegistry } from "./registry.ts";
import { createTestHookRegistry } from "./testing.ts";

type TestContext = {
  value: number;
};

const testHook = createHook<TestContext>("@freeanima/kernel-hooks/test/example", "test hook");

function newRegistry(): HookRegistry {
  return createTestHookRegistry();
}

const ALL = { llm_kind: "all" as const };
const CONV = { llm_kind: "conversation" as const };

describe("HookRegistry", () => {
  it("returns empty chain when no handler", async () => {
    const registry = newRegistry();
    const context = { value: 1 };
    const run = await registry.run(testHook, context, CONV);
    expect(run.context).toEqual({ value: 1, llm_kind: "conversation" });
    expect(run.chain).toBeNull();
    expect(run.status).toBe("ok");
    expect(run.blocked).toBe(false);
    expect(run.blockedMessage).toBeUndefined();
  });

  it("run executes handlers in ascending priority", async () => {
    const registry = newRegistry();
    const order: number[] = [];
    registry.on(
      testHook,
      () => {
        order.push(2);
        return { status: "ok" };
      },
      { priority: 200, llm_kind: "all" },
    );
    registry.on(
      testHook,
      () => {
        order.push(1);
        return { status: "ok" };
      },
      { priority: 50, llm_kind: "all" },
    );
    await registry.run(testHook, { value: 1 }, CONV);
    expect(order).toEqual([1, 2]);
  });

  it("chain head is last handler data with multiple handlers", async () => {
    const registry = newRegistry();
    registry.on(
      testHook,
      () => ({
        status: "ok",
        data: { a: 1 },
      }),
      ALL,
    );
    registry.on(
      testHook,
      () => ({
        status: "ok",
        data: { b: 2 },
      }),
      ALL,
    );
    const run = await registry.run(testHook, { value: 0 }, CONV);
    expect(run.chain?.data).toEqual({ b: 2 });
    expect(run.chain?.prev?.data).toEqual({ a: 1 });
  });

  it("ok+blocked aborts subsequent handlers and sets blockedMessage", async () => {
    const registry = newRegistry();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(
      testHook,
      () => ({
        status: "ok",
        blocked: true,
        message: "stop",
      }),
      ALL,
    );
    registry.on(testHook, second, ALL);
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(run.blocked).toBe(true);
    expect(run.blockedMessage).toBe("stop");
    expect(second).not.toHaveBeenCalled();
  });

  it("failed does not abort subsequent handlers", async () => {
    const registry = newRegistry();
    const order: string[] = [];
    registry.on(
      testHook,
      () => {
        order.push("fail");
        return { status: "failed", message: "oops" };
      },
      ALL,
    );
    registry.on(
      testHook,
      () => {
        order.push("ok");
        return { status: "ok" };
      },
      ALL,
    );
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(order).toEqual(["fail", "ok"]);
    expect(run.status).toBe("failed");
    expect(run.blocked).toBe(false);
    expect(walkHookChain(run.chain)).toHaveLength(2);
  });

  it("blocked on failed step ignored and no short-circuit", async () => {
    const registry = newRegistry();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(
      testHook,
      () => ({
        status: "failed",
        blocked: true,
        message: "ignored",
      }),
      ALL,
    );
    registry.on(testHook, second, ALL);
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(second).toHaveBeenCalledTimes(1);
    expect(run.blocked).toBe(false);
  });

  it("prev chain: head is last executed handler", async () => {
    const registry = newRegistry();
    registry.on(testHook, () => ({ status: "ok", data: { n: 1 } }), ALL);
    registry.on(testHook, () => ({ status: "ok", data: { n: 2 } }), ALL);
    const run = await registry.run(testHook, { value: 0 }, CONV);
    expect(run.chain?.data?.n).toBe(2);
    expect(run.chain?.prev?.data?.n).toBe(1);
  });

  it("handler throw becomes failed step without rethrow", async () => {
    const registry = newRegistry();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(
      testHook,
      () => {
        throw new Error("handler failed");
      },
      ALL,
    );
    registry.on(testHook, second, ALL);
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(run.status).toBe("failed");
    expect(run.chain?.prev?.status).toBe("failed");
    expect(run.chain?.prev?.message).toBe("handler failed");
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("handler returning void treated as ok", async () => {
    const registry = newRegistry();
    registry.on(testHook, () => {}, ALL);
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(run.chain?.status).toBe("ok");
    expect(run.status).toBe("ok");
  });

  it("blocked without message does not set blockedMessage", async () => {
    const registry = newRegistry();
    registry.on(testHook, () => ({ status: "ok", blocked: true }), ALL);
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(run.blocked).toBe(true);
    expect(run.blockedMessage).toBeUndefined();
  });

  it("does not run after unregister", async () => {
    const registry = newRegistry();
    const handler = vi.fn(() => ({ status: "ok" as const }));
    const off = registry.on(testHook, handler, ALL);
    off();
    await registry.run(testHook, { value: 1 }, CONV);
    expect(handler).not.toHaveBeenCalled();
  });

  it("unregister removes only matching handler", async () => {
    const registry = newRegistry();
    const removed = vi.fn(() => ({ status: "ok" as const }));
    const kept = vi.fn(() => ({ status: "ok" as const }));
    const off = registry.on(testHook, removed, ALL);
    registry.on(testHook, kept, ALL);
    off();
    await registry.run(testHook, { value: 1 }, CONV);
    expect(removed).not.toHaveBeenCalled();
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it("run returns empty chain after unregistering last handler", async () => {
    const registry = newRegistry();
    const off = registry.on(testHook, () => ({ status: "ok" }), ALL);
    off();
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(run.chain).toBeNull();
  });

  it("duplicate unregister is safe", async () => {
    const registry = newRegistry();
    const off = registry.on(testHook, () => ({ status: "ok" }), ALL);
    off();
    off();
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(run.chain).toBeNull();
  });

  it("duplicate unregister with other handlers does not error", async () => {
    const registry = newRegistry();
    const kept = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, kept, ALL);
    const off = registry.on(testHook, () => ({ status: "ok" }), ALL);
    off();
    off();
    await registry.run(testHook, { value: 1 }, CONV);
    expect(kept).toHaveBeenCalledTimes(1);
  });

  it("can re-register and run after unregister", async () => {
    const registry = newRegistry();
    const first = vi.fn(() => ({ status: "ok" as const }));
    const off = registry.on(testHook, first, ALL);
    off();
    const second = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, second, ALL);
    await registry.run(testHook, { value: 1 }, CONV);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("same handler registered twice runs twice", async () => {
    const registry = newRegistry();
    const handler = vi.fn(() => ({ status: "ok" as const }));
    registry.on(testHook, handler, ALL);
    registry.on(testHook, handler, ALL);
    await registry.run(testHook, { value: 1 }, CONV);
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("subscribe fires without awaiting and does not block run", async () => {
    const registry = newRegistry();
    let subscriberStarted = false;
    let subscriberFinished = false;
    let resolveSlow: (() => void) | undefined;
    const slowDone = new Promise<void>((r) => {
      resolveSlow = r;
    });
    registry.subscribe(
      testHook,
      async () => {
        subscriberStarted = true;
        await slowDone;
        subscriberFinished = true;
      },
      ALL,
    );
    const run = await registry.run(testHook, { value: 1 }, CONV);
    expect(run.status).toBe("ok");
    expect(subscriberStarted).toBe(true);
    expect(subscriberFinished).toBe(false);
    resolveSlow?.();
    await slowDone;
    expect(subscriberFinished).toBe(true);
  });

  it("subscribe still fires when there are no on handlers", async () => {
    const registry = newRegistry();
    const seen: number[] = [];
    registry.subscribe(
      testHook,
      (ctx) => {
        seen.push(ctx.value);
      },
      ALL,
    );
    await registry.run(testHook, { value: 7 }, CONV);
    await new Promise<void>((r) => {
      setTimeout(r, 0);
    });
    expect(seen).toEqual([7]);
  });

  it("emit is fire-and-forget run", async () => {
    const registry = newRegistry();
    const seen: number[] = [];
    registry.subscribe(
      testHook,
      (ctx) => {
        seen.push(ctx.value);
      },
      ALL,
    );
    registry.emit(testHook, { value: 3 }, CONV);
    await new Promise<void>((r) => {
      setTimeout(r, 0);
    });
    expect(seen).toEqual([3]);
  });

  it("on handlers still await before subscribe starts", async () => {
    const registry = newRegistry();
    const order: string[] = [];
    registry.on(
      testHook,
      async () => {
        order.push("on-start");
        await Promise.resolve();
        order.push("on-end");
        return { status: "ok" };
      },
      ALL,
    );
    registry.subscribe(
      testHook,
      () => {
        order.push("sub");
      },
      ALL,
    );
    await registry.run(testHook, { value: 1 }, CONV);
    expect(order).toEqual(["on-start", "on-end", "sub"]);
  });

  it("filters on/subscribe by llm_kind and injects run llm_kind into context", async () => {
    const registry = newRegistry();
    const seenOn: string[] = [];
    const seenSub: string[] = [];
    registry.on(
      testHook,
      (ctx) => {
        seenOn.push(`conv:${ctx.llm_kind}`);
        return { status: "ok" };
      },
      { llm_kind: "conversation" },
    );
    registry.on(
      testHook,
      (ctx) => {
        seenOn.push(`auto:${ctx.llm_kind}`);
        return { status: "ok" };
      },
      { llm_kind: "auto_llm" },
    );
    registry.on(
      testHook,
      (ctx) => {
        seenOn.push(`all:${ctx.llm_kind}`);
        return { status: "ok" };
      },
      ALL,
    );
    registry.subscribe(
      testHook,
      (ctx) => {
        seenSub.push(ctx.llm_kind);
      },
      { llm_kind: "auto_llm" },
    );

    await registry.run(testHook, { value: 1 }, { llm_kind: "auto_llm" });
    await new Promise<void>((r) => {
      setTimeout(r, 0);
    });
    expect(seenOn).toEqual(["auto:auto_llm", "all:auto_llm"]);
    expect(seenSub).toEqual(["auto_llm"]);
  });
});
