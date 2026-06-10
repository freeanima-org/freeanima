import { describe, expect, it } from "bun:test";
import { RateLimitedLogger } from "@freeanima/kernel-retry";

describe("Discord shard error log limiter", () => {
  it("high-frequency shardError only stepped release", () => {
    const rl = new RateLimitedLogger([100, 200]);
    const key = "shard:0";
    const t0 = 0;
    const hits: number[] = [];
    for (let i = 0; i < 20; i++) {
      if (rl.shouldLog(key, t0 + i * 50)) hits.push(t0 + i * 50);
    }
    expect(hits.length).toBeLessThan(20);
    expect(hits[0]).toBe(0);
  });
});
