import { describe, expect, it, vi } from "bun:test";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { MemoryEventQueue } from "./adapters/memory";
import { NullEventQueue } from "./adapters/null";
import { EventBus } from "./event-bus";
import { createEventTopic } from "./topic";

type PingPayload = { n: number };

const ping = createEventTopic<PingPayload>("@freeanima/kernel-eventbus/test/ping");

function newBus(queue: MemoryEventQueue | NullEventQueue): EventBus {
  return new EventBus(createLogger({ level: "debug", sinks: [createNullSink()] }), queue);
}

async function waitUntil(predicate: () => boolean, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

describe("EventBus + MemoryEventQueue", () => {
  it("start 前 emit 入队，start 后 dispatch handler", async () => {
    const bus = newBus(new MemoryEventQueue());
    const seen: number[] = [];
    bus.on(ping, (p) => {
      seen.push(p.n);
    });
    bus.emit(ping, { n: 1 });
    expect(seen).toEqual([]);
    bus.start();
    await waitUntil(() => seen.length === 1);
    expect(seen).toEqual([1]);
    bus.stop();
  });

  it("无 handler 时 emit 不抛错", async () => {
    const bus = newBus(new MemoryEventQueue());
    bus.emit(ping, { n: 1 });
    bus.start();
    await new Promise((r) => setTimeout(r, 20));
    bus.stop();
  });

  it("同 topic 多 handler 均被调用", async () => {
    const bus = newBus(new MemoryEventQueue());
    const order: string[] = [];
    bus.on(ping, () => {
      order.push("a");
    });
    bus.on(ping, () => {
      order.push("b");
    });
    bus.emit(ping, { n: 1 });
    bus.start();
    await waitUntil(() => order.length === 2);
    expect(order).toEqual(["a", "b"]);
    bus.stop();
  });

  it("handler 抛错时中断同 event 的后续 handler", async () => {
    const bus = newBus(new MemoryEventQueue());
    const second = vi.fn();
    bus.on(ping, () => {
      throw new Error("boom");
    });
    bus.on(ping, second);
    bus.emit(ping, { n: 1 });
    bus.start();
    await waitUntil(() => second.mock.calls.length === 0, 200);
    expect(second).not.toHaveBeenCalled();
    bus.stop();
  });

  it("on 返回注销函数", async () => {
    const bus = newBus(new MemoryEventQueue());
    const handler = vi.fn();
    const off = bus.on(ping, handler);
    off();
    bus.emit(ping, { n: 1 });
    bus.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(handler).not.toHaveBeenCalled();
    bus.stop();
  });
});

describe("EventBus + NullEventQueue", () => {
  it("emit 后 handler 不被调用", async () => {
    const bus = newBus(new NullEventQueue());
    const handler = vi.fn();
    bus.on(ping, handler);
    bus.emit(ping, { n: 1 });
    bus.start();
    await new Promise((r) => setTimeout(r, 30));
    expect(handler).not.toHaveBeenCalled();
    bus.stop();
  });
});
