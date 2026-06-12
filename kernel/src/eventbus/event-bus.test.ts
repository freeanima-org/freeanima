import { describe, expect, it, vi } from "bun:test";
import { createLogger } from "../logging/index.ts";
import { createNullSink } from "../logging/sinks/null.ts";
import { MemoryEventQueue } from "./adapters/memory.ts";
import { NullEventQueue } from "./adapters/null.ts";
import { EventBus } from "./event-bus.ts";
import { createEventTopic } from "./topic.ts";

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
  it("emit enqueues before start; dispatches after start", async () => {
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

  it("emit does not throw without handler", async () => {
    const bus = newBus(new MemoryEventQueue());
    bus.emit(ping, { n: 1 });
    bus.start();
    await new Promise((r) => setTimeout(r, 20));
    bus.stop();
  });

  it("multiple handlers on same topic all called", async () => {
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

  it("handler throw aborts subsequent handlers for same event", async () => {
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

  it("on returns unregister function", async () => {
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
  it("handler not called after emit when unregistered", async () => {
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
