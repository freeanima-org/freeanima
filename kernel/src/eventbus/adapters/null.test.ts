import { describe, expect, it, vi } from "bun:test";
import { NullEventQueue } from "./null.ts";

describe("NullEventQueue", () => {
  it("enqueue / start / stop are no-op", async () => {
    const queue = new NullEventQueue();
    const process = vi.fn(async () => "ack" as const);

    expect(() => queue.enqueue("topic", { n: 1 })).not.toThrow();
    expect(() => queue.start(process)).not.toThrow();
    expect(() => queue.stop()).not.toThrow();

    await new Promise((r) => {
      setTimeout(r, 10);
    });
    expect(process).not.toHaveBeenCalled();
  });

  it("repeated start / stop do not throw", () => {
    const queue = new NullEventQueue();
    queue.enqueue("t", null);
    queue.start(async () => "ack");
    queue.start(async () => "ack");
    queue.stop();
    expect(() => queue.stop()).not.toThrow();
  });
});
