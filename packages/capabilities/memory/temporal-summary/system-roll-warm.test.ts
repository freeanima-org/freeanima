import { describe, expect, it, mock } from "bun:test";

import { scheduleTemporalSystemRollWarm } from "./system-roll-warm.ts";

const baseConfig = {
  enabled: true,
  chunk_max_chars: 50,
  peer_roll_max_chars: 100,
  global_day_max_chars: 100,
  month_max_chars: 100,
  year_max_chars: 100,
  system_prompt_max_chars: 1500,
  redis_key_prefix: "anima:temporal",
  peer_roll_ttl_seconds: 36 * 60 * 60,
} as const;

describe("scheduleTemporalSystemRollWarm", () => {
  it("后台按 kinds 调用 regenerate", async () => {
    const regenerateOne = mock(async (opts: { kind: string }) => ({
      kind: opts.kind as "past_days",
      anchor: "x",
      label: opts.kind,
      cache_hit: false,
      summary: "ok",
      sources_fp: null,
      created_at: null,
      source_count: 0,
      redis_key: "k",
    }));
    scheduleTemporalSystemRollWarm({
      kinds: ["past_days", "past_months"],
      config: baseConfig,
      world_id: 42,
      regenerateOne,
    });
    await new Promise<void>((r) => {
      setTimeout(() => r(), 30);
    });
    expect(regenerateOne).toHaveBeenCalledTimes(2);
    expect(regenerateOne.mock.calls[0]?.[0]?.kind).toBe("past_days");
    expect(regenerateOne.mock.calls[1]?.[0]?.kind).toBe("past_months");
  });

  it("enabled=false 时不调用", async () => {
    const regenerateOne = mock(async () => {
      throw new Error("should not run");
    });
    scheduleTemporalSystemRollWarm({
      kinds: ["past_years"],
      config: { ...baseConfig, enabled: false },
      world_id: 42,
      regenerateOne,
    });
    await new Promise<void>((r) => {
      setTimeout(() => r(), 20);
    });
    expect(regenerateOne).not.toHaveBeenCalled();
  });
});
