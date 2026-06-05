import { describe, expect, it } from "bun:test";
import { RateLimitedLogger } from "../src/rate-limited-logger.ts";

describe("RateLimitedLogger", () => {
  it("同 key 在窗口内只放行一次", () => {
    const rl = new RateLimitedLogger([100, 200]);
    const t0 = 1_000;
    expect(rl.shouldLog("a", t0)).toBe(true);
    expect(rl.shouldLog("a", t0 + 50)).toBe(false);
    expect(rl.shouldLog("a", t0 + 100)).toBe(true);
    expect(rl.shouldLog("a", t0 + 150)).toBe(false);
    expect(rl.shouldLog("a", t0 + 300)).toBe(true);
  });

  it("不同 key 互不影响", () => {
    const rl = new RateLimitedLogger([50]);
    expect(rl.shouldLog("a", 0)).toBe(true);
    expect(rl.shouldLog("b", 0)).toBe(true);
    expect(rl.shouldLog("a", 10)).toBe(false);
    expect(rl.shouldLog("b", 10)).toBe(false);
  });

  it("reset 单 key 后重新放行", () => {
    const rl = new RateLimitedLogger([1000]);
    expect(rl.shouldLog("x", 0)).toBe(true);
    expect(rl.shouldLog("x", 1)).toBe(false);
    rl.reset("x");
    expect(rl.shouldLog("x", 2)).toBe(true);
  });

  it("reset 无参清空全部", () => {
    const rl = new RateLimitedLogger([100]);
    expect(rl.shouldLog("a", 0)).toBe(true);
    rl.reset();
    expect(rl.shouldLog("a", 1)).toBe(true);
  });
});
