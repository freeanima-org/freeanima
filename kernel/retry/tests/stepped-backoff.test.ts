import { describe, expect, it } from "bun:test";
import { DEFAULT_STEPPED_DELAYS_MS, SteppedBackoff } from "../src/stepped-backoff.ts";

describe("SteppedBackoff", () => {
  it("steps up and holds last tier", () => {
    const b = new SteppedBackoff([100, 200, 300]);
    expect(b.nextDelayMs()).toBe(100);
    expect(b.nextDelayMs()).toBe(200);
    expect(b.nextDelayMs()).toBe(300);
    expect(b.nextDelayMs()).toBe(300);
    expect(b.attempt).toBe(4);
  });

  it("reset restarts from first tier", () => {
    const b = new SteppedBackoff([10, 20]);
    b.nextDelayMs();
    b.nextDelayMs();
    b.reset();
    expect(b.attempt).toBe(0);
    expect(b.nextDelayMs()).toBe(10);
  });

  it("default steps match constants", () => {
    const b = new SteppedBackoff();
    for (const d of DEFAULT_STEPPED_DELAYS_MS) {
      expect(b.nextDelayMs()).toBe(d);
    }
    expect(b.nextDelayMs()).toBe(60_000);
  });

  it("empty delays throws", () => {
    expect(() => new SteppedBackoff([])).toThrow("delaysMs cannot be empty");
  });
});
