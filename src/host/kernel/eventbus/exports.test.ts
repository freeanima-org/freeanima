import { describe, expect, it } from "bun:test";
import { createTestEventBus } from "./testing.ts";
import { createEventTopic } from "./topic.ts";

describe("@freeanima/host/kernel/eventbus/testing export", () => {
  it("createTestEventBus dispatches after start", async () => {
    const bus = createTestEventBus();
    const topic = createEventTopic<{ n: number }>("test.exports", "exports smoke");
    let seen = 0;
    bus.on(topic, (p) => {
      seen = p.n;
    });
    bus.emit(topic, { n: 42 });
    expect(seen).toBe(0);
    bus.start();
    await new Promise((r) => {
      setTimeout(r, 20);
    });
    expect(seen).toBe(42);
    bus.stop();
  });
});
