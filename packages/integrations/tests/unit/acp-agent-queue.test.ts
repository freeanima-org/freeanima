import { describe, it, expect } from "bun:test";
import { AcpAgentQueue } from "../../src/acp/agent-queue.ts";

describe("AcpAgentQueue", () => {
  it("串行执行", async () => {
    const q = new AcpAgentQueue();
    const order: number[] = [];
    const a = q.run(async () => {
      await new Promise((r) => setTimeout(r, 30));
      order.push(1);
    });
    const b = q.run(async () => {
      order.push(2);
    });
    await Promise.all([a, b]);
    expect(order).toEqual([1, 2]);
  });
});
