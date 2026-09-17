import { describe, expect, it } from "bun:test";
import { KeyedRateLimiter } from "./keyed-rate-limiter.ts";

describe("KeyedRateLimiter", () => {
  it("same key allowed once per window", () => {
    const rl = new KeyedRateLimiter([100, 200]);
    const t0 = 1_000;
    expect(rl.allow("a", t0)).toBe(true);
    expect(rl.allow("a", t0 + 50)).toBe(false);
    expect(rl.allow("a", t0 + 100)).toBe(true);
    expect(rl.allow("a", t0 + 150)).toBe(false);
    expect(rl.allow("a", t0 + 300)).toBe(true);
  });

  it("different keys independent", () => {
    const rl = new KeyedRateLimiter([50]);
    expect(rl.allow("a", 0)).toBe(true);
    expect(rl.allow("b", 0)).toBe(true);
    expect(rl.allow("a", 10)).toBe(false);
    expect(rl.allow("b", 10)).toBe(false);
  });

  it("reset single key re-allows", () => {
    const rl = new KeyedRateLimiter([1000]);
    expect(rl.allow("x", 0)).toBe(true);
    expect(rl.allow("x", 1)).toBe(false);
    rl.reset("x");
    expect(rl.allow("x", 2)).toBe(true);
  });

  it("reset without args clears all", () => {
    const rl = new KeyedRateLimiter([100]);
    expect(rl.allow("a", 0)).toBe(true);
    rl.reset();
    expect(rl.allow("a", 1)).toBe(true);
  });
});
