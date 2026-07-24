import { describe, expect, it } from "bun:test";
import { KeyedRateLimiter } from "@freeanima/host/core/util/backoff";

describe("Discord shard error log limiter", () => {
  it("steps backoff per shard key", () => {
    const rl = new KeyedRateLimiter([100, 200]);
    const t0 = 1_000;
    expect(rl.allow(`shard:1`, t0)).toBe(true);
    expect(rl.allow(`shard:1`, t0 + 50)).toBe(false);
    expect(rl.allow(`shard:1`, t0 + 100)).toBe(true);
  });
});
