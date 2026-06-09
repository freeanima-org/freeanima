import { describe, it, expect, vi } from "bun:test";
import type { RedisClient } from "bun";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { EventBus, createEventTopic } from "@freeanima/kernel-eventbus";
import { RedisEventQueue } from "./redis-event-queue.ts";
import { createMockRedisLists, seedPendingEvent, seedProcessingEvent } from "./test-helpers.ts";

const testPing = createEventTopic<{ n: number }>("test:ping");

async function waitFor(predicate: () => boolean, timeoutMs = 400): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() >= deadline) {
      throw new Error(`waitFor timed out after ${timeoutMs}ms`);
    }
    await new Promise((r) => setTimeout(r, 10));
  }
}

function createQueue(): {
  queue: RedisEventQueue;
  lists: ReturnType<typeof createMockRedisLists>["lists"];
} {
  const mock = createMockRedisLists();
  const queue = new RedisEventQueue(mock.client as unknown as RedisClient, {
    blockSec: 0,
    pollMs: 5,
  });
  return { queue, lists: mock.lists };
}

describe("RedisEventQueue", () => {
  it("reads pending events and dispatches", async () => {
    const { queue, lists } = createQueue();
    seedPendingEvent(lists, testPing.qualifiedId, { n: 1 });

    const bus = new EventBus(createLogger({ sinks: [createNullSink()] }), queue);
    const seen: number[] = [];
    bus.on(testPing, (p) => {
      seen.push(p.n);
    });
    bus.start();
    await waitFor(() => seen.length === 1);
    bus.stop();
    expect(seen).toEqual([1]);
  });

  it("enqueue 后 start 可 dispatch", async () => {
    const { queue } = createQueue();
    const bus = new EventBus(createLogger({ sinks: [createNullSink()] }), queue);
    const seen: number[] = [];
    bus.on(testPing, (p) => {
      seen.push(p.n);
    });
    bus.start();
    bus.emit(testPing, { n: 42 });
    await waitFor(() => seen.length === 1);
    bus.stop();
    expect(seen).toEqual([42]);
  });

  it("handler 抛错且已达 maxRetries 时 fail", async () => {
    const { queue, lists } = createQueue();
    seedPendingEvent(lists, testPing.qualifiedId, { n: 1 }, { id: 1, retries: 3 });

    let attempts = 0;
    const bus = new EventBus(createLogger({ sinks: [createNullSink()] }), queue);
    bus.on(testPing, () => {
      attempts++;
      throw new Error("boom");
    });
    bus.start();
    await waitFor(() => attempts >= 1);
    await new Promise((r) => setTimeout(r, 50));
    bus.stop();
    expect(attempts).toBe(1);
    expect(lists.pending).toHaveLength(0);
    expect(lists.processing).toHaveLength(0);
  });

  it("start 重复调用为 no-op", async () => {
    const { queue, lists } = createQueue();
    seedPendingEvent(lists, testPing.qualifiedId, { n: 1 });

    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    queue.start(process);
    await waitFor(() => process.mock.calls.length === 1);
    queue.stop();
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("stop 后不再 dispatch", async () => {
    const { queue, lists } = createQueue();
    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    queue.stop();
    seedPendingEvent(lists, testPing.qualifiedId, { n: 1 });
    await new Promise((r) => setTimeout(r, 30));
    expect(process).not.toHaveBeenCalled();
  });

  it("resetStuck 将 processing 迁回 pending", async () => {
    const { queue, lists } = createQueue();
    seedProcessingEvent(lists, testPing.qualifiedId, { n: 7 }, { id: 1 });

    const bus = new EventBus(createLogger({ sinks: [createNullSink()] }), queue);
    const seen: number[] = [];
    bus.on(testPing, (p) => {
      seen.push(p.n);
    });
    bus.start();
    await waitFor(() => seen.length === 1);
    bus.stop();
    expect(seen).toEqual([7]);
    expect(lists.processing).toHaveLength(0);
  });

  it("无效 JSON envelope 从 processing 移除", async () => {
    const { queue, lists } = createQueue();
    lists.processing.unshift("not-json");

    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    await new Promise((r) => setTimeout(r, 30));
    queue.stop();
    expect(process).not.toHaveBeenCalled();
    expect(lists.processing).toHaveLength(0);
  });
});
