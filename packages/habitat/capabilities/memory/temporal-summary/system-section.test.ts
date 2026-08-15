import { describe, expect, it, mock } from "bun:test";

import { SYS_ROLL_TTL_SECONDS, sysRollTtlSeconds } from "./config.ts";
import { buildTemporalSummarySystemBody } from "./system-section.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import type { PeerRollCache } from "./tick.ts";

mock.module("@freeanima/habitat/core/db/pg/temporal-summary", () => ({
  listTemporalSummariesInRange: mock(async () => []),
}));

const baseConfig: ResolvedTemporalSummaryConfig = {
  enabled: true,
  chunk_max_chars: 50,
  peer_roll_max_chars: 100,
  global_day_max_chars: 100,
  month_max_chars: 100,
  year_max_chars: 100,
  system_prompt_max_chars: 1500,
  redis_key_prefix: "anima:temporal",
  peer_roll_ttl_seconds: 36 * 60 * 60,
};

describe("sysRollTtlSeconds", () => {
  it("按时间粒度返回 TTL", () => {
    expect(sysRollTtlSeconds("past_days")).toBe(SYS_ROLL_TTL_SECONDS.past_days);
    expect(sysRollTtlSeconds("past_months")).toBe(SYS_ROLL_TTL_SECONDS.past_months);
    expect(sysRollTtlSeconds("past_years")).toBe(SYS_ROLL_TTL_SECONDS.past_years);
    expect(SYS_ROLL_TTL_SECONDS.past_days).toBe(86400);
    expect(SYS_ROLL_TTL_SECONDS.past_months).toBe(31 * 86400);
    expect(SYS_ROLL_TTL_SECONDS.past_years).toBe(366 * 86400);
  });
});

describe("buildTemporalSummarySystemBody（只读缓存）", () => {
  it("无缓存时为空且不写 Redis", async () => {
    let wrote = false;
    const peerCache: PeerRollCache = {
      getJson: async <T>(_key: string): Promise<T | null> => null,
      setJson: async () => {
        wrote = true;
      },
    };
    const { body, truncated } = await buildTemporalSummarySystemBody(baseConfig, {
      peerCache,
      nowMs: Date.parse("2026-08-15T04:00:00.000Z"),
    });
    expect(body).toBe("");
    expect(truncated).toBe(false);
    expect(wrote).toBe(false);
  });

  it("仅注入 cache hit 的摘要", async () => {
    let wrote = false;
    const peerCache: PeerRollCache = {
      getJson: async <T>(key: string): Promise<T | null> => {
        if (key.includes("past_days")) {
          return {
            summary: "日摘要内容",
            sources_fp: "",
            created_at: "2026-08-15T00:00:00.000Z",
          } as T;
        }
        return null;
      },
      setJson: async () => {
        wrote = true;
      },
    };
    const { body } = await buildTemporalSummarySystemBody(baseConfig, {
      peerCache,
      nowMs: Date.parse("2026-08-15T04:00:00.000Z"),
    });
    expect(body).toContain("日摘要内容");
    expect(body).toContain("过往日");
    expect(wrote).toBe(false);
  });
});
