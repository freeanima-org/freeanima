import { describe, it, expect, vi } from "bun:test";
import type { RedisClient } from "bun";
import { createLogger } from "@freeanima/kernel/logging";
import { createNullSink } from "@freeanima/kernel/logging/sinks/null.ts";
import { EventBus, createEventTopic } from "@freeanima/kernel/eventbus";
import { RedisEventQueue, safeCloseOwnedRedisClient } from "./redis-event-queue.ts";
import {
  createMockRedisLists,
  seedPendingEvent,
  seedProcessingEvent,
  waitFor,
} from "./test-helpers.ts";

const testPing = createEventTopic<{ n: number }>("test:ping");

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

  it("start can dispatch after enqueue", async () => {
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

  it("fail when handler throws and maxRetries reached", async () => {
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
    await new Promise((r) => {
      setTimeout(r, 50);
    });
    bus.stop();
    expect(attempts).toBe(1);
    expect(lists.pending).toHaveLength(0);
    expect(lists.processing).toHaveLength(0);
  });

  it("repeated start calls are no-op", async () => {
    const { queue, lists } = createQueue();
    seedPendingEvent(lists, testPing.qualifiedId, { n: 1 });

    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    queue.start(process);
    await waitFor(() => process.mock.calls.length === 1);
    queue.stop();
    expect(process).toHaveBeenCalledTimes(1);
  });

  it("no dispatch after stop", async () => {
    const { queue, lists } = createQueue();
    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    queue.stop();
    seedPendingEvent(lists, testPing.qualifiedId, { n: 1 });
    await new Promise((r) => {
      setTimeout(r, 30);
    });
    expect(process).not.toHaveBeenCalled();
  });

  it("resetStuck moves processing back to pending", async () => {
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

  it("invalid JSON envelope removed from processing", async () => {
    const { queue, lists } = createQueue();
    lists.processing.unshift("not-json");

    const process = vi.fn(async () => "ack" as const);
    queue.start(process);
    await new Promise((r) => {
      setTimeout(r, 30);
    });
    queue.stop();
    expect(process).not.toHaveBeenCalled();
    expect(lists.processing).toHaveLength(0);
  });

  it("safeCloseOwnedRedisClient swallows Connection closed", () => {
    const client = {
      close: () => {
        throw Object.assign(new Error("Connection closed"), {
          code: "ERR_REDIS_CONNECTION_CLOSED",
        });
      },
    } as unknown as RedisClient;
    expect(() => safeCloseOwnedRedisClient(client)).not.toThrow();
  });
});
