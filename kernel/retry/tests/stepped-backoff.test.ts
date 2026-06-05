import { describe, expect, it } from "bun:test";
import { DEFAULT_STEPPED_DELAYS_MS, SteppedBackoff } from "../src/stepped-backoff.ts";

describe("SteppedBackoff", () => {
  it("按阶梯递增并在末档保持", () => {
    const b = new SteppedBackoff([100, 200, 300]);
    expect(b.nextDelayMs()).toBe(100);
    expect(b.nextDelayMs()).toBe(200);
    expect(b.nextDelayMs()).toBe(300);
    expect(b.nextDelayMs()).toBe(300);
    expect(b.attempt).toBe(4);
  });

  it("reset 后从首档重新开始", () => {
    const b = new SteppedBackoff([10, 20]);
    b.nextDelayMs();
    b.nextDelayMs();
    b.reset();
    expect(b.attempt).toBe(0);
    expect(b.nextDelayMs()).toBe(10);
  });

  it("默认阶梯与常量一致", () => {
    const b = new SteppedBackoff();
    for (const d of DEFAULT_STEPPED_DELAYS_MS) {
      expect(b.nextDelayMs()).toBe(d);
    }
    expect(b.nextDelayMs()).toBe(60_000);
  });

  it("空 delays 抛错", () => {
    expect(() => new SteppedBackoff([])).toThrow("delaysMs 不能为空");
  });
});
