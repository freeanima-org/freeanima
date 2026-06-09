import { describe, it, expect } from "bun:test";
import { createLogger } from "@freeanima/kernel-logging";
import { createNullSink } from "@freeanima/kernel-logging/null";
import { EventBus, createEventTopic } from "@freeanima/kernel-eventbus";
import { SqliteEventQueue } from "./sqlite-event-queue.ts";
import { waitFor } from "./test-helpers.ts";

const testPing = createEventTopic<{ n: number }>("test:ping");

describe("SqliteEventQueue", () => {
  it("reads pending events from memory db", async () => {
    const queue = new SqliteEventQueue(":memory:", { pollMs: 10 });
    queue.enqueue(testPing.qualifiedId, { n: 1 });

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
});
