import { describe, expect, it, mock } from "bun:test";

import { SYS_ROLL_TTL_SECONDS } from "./config.ts";
import type { PeerRollCache } from "./tick.ts";

mock.module("@freeanima/habitat/core/db/pg/temporal-summary", () => ({
  listTemporalSummariesInRange: mock(async () => [
    { period_start: "2026-08-01", content: "主题A" },
    { period_start: "2026-08-10", content: "主题B" },
  ]),
}));

mock.module("./summarize.ts", () => ({
  summarizeTemporalText: mock(async () => "合并摘要"),
  temporalSummaryHardCap: (n: number) => Math.ceil(n * 1.5),
}));

const { regenerateTemporalSystemRoll } = await import("./system-rolls.ts");

describe("regenerateTemporalSystemRoll TTL", () => {
  it("写入 Redis 时使用 past_days 粒度 TTL", async () => {
    const ttls: number[] = [];
    const peerCache: PeerRollCache = {
      getJson: async <T>(_key: string): Promise<T | null> => null,
      setJson: async (_key, _value, ttlSeconds) => {
        ttls.push(ttlSeconds);
      },
    };
    await regenerateTemporalSystemRoll({
      kind: "past_days",
      config: {
        enabled: true,
        chunk_max_chars: 50,
        peer_roll_max_chars: 100,
        global_day_max_chars: 100,
        month_max_chars: 100,
        year_max_chars: 100,
        system_prompt_max_chars: 1500,
        redis_key_prefix: "anima:temporal",
        peer_roll_ttl_seconds: 36 * 60 * 60,
      },
      peerCache,
      nowMs: Date.parse("2026-08-15T04:00:00.000Z"),
    });
    expect(ttls).toEqual([SYS_ROLL_TTL_SECONDS.past_days]);
  });
});
