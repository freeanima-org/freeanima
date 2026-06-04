import { describe, expect, it, vi } from "bun:test";
import { NullEventQueue } from "./null";

describe("NullEventQueue", () => {
  it("enqueue / start / stop 均为 no-op", async () => {
    const queue = new NullEventQueue();
    const process = vi.fn(async () => "ack" as const);

    expect(() => queue.enqueue("topic", { n: 1 })).not.toThrow();
    expect(() => queue.start(process)).not.toThrow();
    expect(() => queue.stop()).not.toThrow();

    await new Promise((r) => setTimeout(r, 10));
    expect(process).not.toHaveBeenCalled();
  });

  it("重复 start / stop 不抛错", () => {
    const queue = new NullEventQueue();
    queue.start(async () => "ack");
    queue.start(async () => "ack");
    queue.stop();
    expect(() => queue.stop()).not.toThrow();
  });
});
