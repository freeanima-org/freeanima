import { describe, it, expect } from "vitest";
import { createHookRegistry } from "@freeanima/kernel";

describe("HookRegistry", () => {
  it("按 priority 顺序执行 handler", async () => {
    const registry = createHookRegistry();
    const order: number[] = [];
    registry.on("message:incoming", () => {
      order.push(2);
    }, { priority: 200 });
    registry.on("message:incoming", () => {
      order.push(1);
    }, { priority: 50 });
    await registry.run("message:incoming", {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
    });
    expect(order).toEqual([1, 2]);
  });

  it("handler 可变更 ctx", async () => {
    const registry = createHookRegistry();
    registry.on("message:incoming", (ctx) => {
      ctx.transformedMessage = `[${ctx.message}]`;
    });
    const ctx = await registry.run("message:incoming", {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
    });
    expect(ctx.transformedMessage).toBe("[hi]");
  });

  it("unregister 后不再执行", async () => {
    const registry = createHookRegistry();
    let called = false;
    const off = registry.on("tool:after_call", () => {
      called = true;
    });
    off();
    await registry.run("tool:after_call", {
      sessionId: "s1",
      toolName: "clarify",
      args: {},
      result: "{}",
    });
    expect(called).toBe(false);
  });

  it("tool:after_call 可设置 turnControl", async () => {
    const registry = createHookRegistry();
    registry.on("tool:after_call", (ctx) => {
      if (ctx.toolName === "clarify") {
        ctx.turnControl = {
          pause: true,
          streamEvents: [
            {
              event: "awaiting_clarify",
              data: { items: [{ question: "?" }], timeout_sec: 60 },
            },
            { event: "done", data: { reason: "awaiting_clarify" } },
          ],
        };
      }
    });
    const ctx = await registry.run("tool:after_call", {
      sessionId: "s1",
      toolName: "clarify",
      args: {},
      result: '{"status":"awaiting"}',
    });
    expect(ctx.turnControl?.pause).toBe(true);
    expect(ctx.turnControl?.streamEvents).toHaveLength(2);
  });
});
