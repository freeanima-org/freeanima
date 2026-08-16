import { describe, expect, it, mock } from "bun:test";

import {
  concatPeerRollSources,
  schedulePeerRollWarm,
  warmPeerRoll,
  type PeerRollCache,
} from "./peer-roll-warm.ts";
import type { ResolvedTemporalSummaryConfig } from "./config.ts";

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

describe("concatPeerRollSources", () => {
  it("按 conversation_id 排序拼接", () => {
    const text = concatPeerRollSources(
      [
        { conversation_id: "b", at: "t1", summary: "B摘要" },
        { conversation_id: "a", at: "t0", summary: "A摘要" },
      ],
      100,
    );
    expect(text).toBe("A摘要\nB摘要");
  });
});

describe("warmPeerRoll", () => {
  it("miss 时 LLM 合并并写 Redis", async () => {
    const writes: Array<{ key: string; value: unknown }> = [];
    const peerCache: PeerRollCache = {
      getJson: async () => null,
      setJson: async (key, value) => {
        writes.push({ key, value });
      },
    };
    const summarize = mock(async () => "LLM合摘要");
    const wrote = await warmPeerRoll({
      cst_date: "2026-08-15",
      bucket: "2026-08-15T11:00+08:00",
      sources: [{ conversation_id: "p1", at: "t", summary: "主题" }],
      config: baseConfig,
      peerCache,
      summarize,
    });
    expect(wrote).toBe(true);
    expect(summarize).toHaveBeenCalledTimes(1);
    expect(writes.length).toBe(1);
    const first = writes[0];
    expect(first).toBeDefined();
    expect((first!.value as { summary: string }).summary).toBe("LLM合摘要");
  });

  it("已命中则跳过", async () => {
    const peerCache: PeerRollCache = {
      getJson: async <T>(): Promise<T | null> =>
        ({ summary: "已有", sources_fp: "x", created_at: "t" }) as T,
      setJson: async () => {
        throw new Error("should not write");
      },
    };
    const summarize = mock(async () => "不应调用");
    const wrote = await warmPeerRoll({
      cst_date: "2026-08-15",
      bucket: "2026-08-15T11:00+08:00",
      sources: [{ conversation_id: "p1", at: "t", summary: "主题" }],
      config: baseConfig,
      peerCache,
      summarize,
    });
    expect(wrote).toBe(false);
    expect(summarize).not.toHaveBeenCalled();
  });
});

describe("schedulePeerRollWarm", () => {
  it("后台调用 warm（不阻塞）", async () => {
    const summarize = mock(async () => "ok");
    const peerCache: PeerRollCache = {
      getJson: async () => null,
      setJson: async () => {},
    };
    schedulePeerRollWarm({
      cst_date: "2026-08-15",
      bucket: "2026-08-15T11:00+08:00",
      sources: [{ conversation_id: "p1", at: "t", summary: "主题" }],
      config: baseConfig,
      peerCache,
      summarize,
    });
    await new Promise<void>((r) => {
      setTimeout(() => r(), 30);
    });
    expect(summarize).toHaveBeenCalledTimes(1);
  });

  it("enabled=false 时不调用", async () => {
    const summarize = mock(async () => {
      throw new Error("should not run");
    });
    schedulePeerRollWarm({
      cst_date: "2026-08-15",
      bucket: "2026-08-15T11:00+08:00",
      sources: [{ conversation_id: "p1", at: "t", summary: "主题" }],
      config: { ...baseConfig, enabled: false },
      peerCache: {
        getJson: async () => null,
        setJson: async () => {},
      },
      summarize,
    });
    await new Promise<void>((r) => {
      setTimeout(() => r(), 20);
    });
    expect(summarize).not.toHaveBeenCalled();
  });
});
