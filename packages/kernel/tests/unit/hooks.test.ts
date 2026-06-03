import { describe, expect, it } from "bun:test";
import { HookRegistry } from "@freeanima/hooks";
import { createLogger } from "@freeanima/logging";
import { createNullSink } from "@freeanima/logging/sinks/null";
import {
  messageIncoming,
  toolAfterCall,
  turnAfterComplete,
} from "@freeanima/legacy-kernel";

describe("legacy-kernel hooks", () => {
  const nullLogger = () =>
    createLogger({ level: "debug", sinks: [createNullSink()] });

  it("hook token 设置 qualifiedId", () => {
    expect(messageIncoming.qualifiedId).toBe(
      "@freeanima/legacy-kernel/hooks/message-incoming",
    );
    expect(toolAfterCall.qualifiedId).toBe(
      "@freeanima/legacy-kernel/hooks/tool-after-call",
    );
    expect(turnAfterComplete.qualifiedId).toBe(
      "@freeanima/legacy-kernel/hooks/turn-after-complete",
    );
  });

  it("按 priority 顺序执行 handler", async () => {
    const registry = new HookRegistry(nullLogger());
    const order: number[] = [];
    registry.on(
      messageIncoming,
      () => {
        order.push(2);
      },
      { priority: 200 },
    );
    registry.on(
      messageIncoming,
      () => {
        order.push(1);
      },
      { priority: 50 },
    );
    await registry.run(messageIncoming, {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
    });
    expect(order).toEqual([1, 2]);
  });

  it("handler 可变更 payload", async () => {
    const registry = new HookRegistry(nullLogger());
    registry.on(messageIncoming, (ctx) => {
      ctx.transformedMessage = `[${ctx.message}]`;
    });
    const ctx = await registry.run(messageIncoming, {
      sessionId: "s1",
      message: "hi",
      platform: "parlor",
    });
    expect(ctx.transformedMessage).toBe("[hi]");
  });

  it("unregister 后不再执行", async () => {
    const registry = new HookRegistry(nullLogger());
    let called = false;
    const off = registry.on(toolAfterCall, () => {
      called = true;
    });
    off();
    await registry.run(toolAfterCall, {
      sessionId: "s1",
      toolName: "clarify",
      args: {},
      result: "{}",
    });
    expect(called).toBe(false);
  });

  it("toolAfterCall 可设置 turnControl", async () => {
    const registry = new HookRegistry(nullLogger());
    registry.on(toolAfterCall, (ctx) => {
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
    const ctx = await registry.run(toolAfterCall, {
      sessionId: "s1",
      toolName: "clarify",
      args: {},
      result: '{"status":"awaiting"}',
    });
    expect(ctx.turnControl?.pause).toBe(true);
    expect(ctx.turnControl?.streamEvents).toHaveLength(2);
  });
});
