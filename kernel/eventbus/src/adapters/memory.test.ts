import { describe, expect, it, vi } from "bun:test";
import { MemoryEventQueue } from "./memory.ts";

async function waitUntil(predicate: () => boolean, timeoutMs = 500): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 5));
  }
}

describe("MemoryEventQueue", () => {
  it("repeated start is no-op", async () => {
    const queue = new MemoryEventQueue();
    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    queue.start(process);
    queue.enqueue("t", { n: 1 });
    await waitUntil(() => process.mock.calls.length === 1);
    queue.stop();
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("enqueue while running drains subsequent events", async () => {
    const queue = new MemoryEventQueue();
    const seen: string[] = [];
    queue.start(async (event) => {
      seen.push(String(event.payload));
      if (seen.length === 1) {
        queue.enqueue("t", "second");
      }
      return "ack";
    });
    queue.enqueue("t", "first");
    await waitUntil(() => seen.length === 2);
    expect(seen).toEqual(["first", "second"]);
    queue.stop();
  });

  it("enqueue during drain continues after completion", async () => {
    const queue = new MemoryEventQueue();
    const seen: string[] = [];
    queue.start(async (event) => {
      seen.push(String(event.payload));
      await new Promise((r) => setTimeout(r, 15));
      return "ack";
    });
    queue.enqueue("t", "first");
    await waitUntil(() => seen.length === 1);
    queue.enqueue("t", "second");
    await waitUntil(() => seen.length === 2);
    expect(seen).toEqual(["first", "second"]);
    queue.stop();
  });

  it("no dispatch after stop", async () => {
    const queue = new MemoryEventQueue();
    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    queue.stop();
    queue.enqueue("t", { n: 1 });
    await new Promise((r) => setTimeout(r, 30));
    expect(process).not.toHaveBeenCalled();
  });

  it("ignores retry outcome and dequeues event", async () => {
    const queue = new MemoryEventQueue();
    const process = vi.fn(async () => "retry" as const);
    queue.start(process);
    queue.enqueue("t", { n: 1 });
    await waitUntil(() => process.mock.calls.length === 1);
    await new Promise((r) => setTimeout(r, 30));
    expect(process).toHaveBeenCalledTimes(1);
    queue.stop();
  });

  it("stop can be called multiple times", () => {
    const queue = new MemoryEventQueue();
    queue.start(async () => "ack");
    queue.stop();
    expect(() => queue.stop()).not.toThrow();
  });
});
