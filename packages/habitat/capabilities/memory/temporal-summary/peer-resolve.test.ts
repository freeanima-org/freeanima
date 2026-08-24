import { afterAll, describe, expect, it, mock } from "bun:test";

import type { ResolvedTemporalSummaryConfig } from "./config.ts";
import type { PeerRollCache } from "./peer-roll-warm.ts";

const listTemporalDayByCstDateMock = mock(async () => [] as unknown[]);

const temporalSummaryOriginal = await import("@freeanima/habitat/core/db/pg/temporal-summary");

mock.module("@freeanima/habitat/core/db/pg/temporal-summary", () => ({
  ...temporalSummaryOriginal,
  listTemporalDayByCstDate: listTemporalDayByCstDateMock,
}));

const { resolvePeerTimelineInjects } = await import("./peer-resolve.ts");
const { peerRollRedisKey, peerRollSourcesFp, temporalBucketStartIso } =
  await import("./buckets.ts");

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg/temporal-summary", () => temporalSummaryOriginal);
});

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

/** 2026-08-15 12:00 CST → 有已关闭桶 */
const nowMs = Date.parse("2026-08-15T04:00:00.000Z");
const closedBucket = temporalBucketStartIso(Date.parse("2026-08-15T03:00:00.000Z"));

describe("resolvePeerTimelineInjects（热路径不打 LLM）", () => {
  it("miss 时拼接截断注入、不写 Redis，并调度后台预热", async () => {
    listTemporalDayByCstDateMock.mockImplementation(async () => [
      {
        conversation_id: "peer-1",
        temporal_day: {
          cst_date: "2026-08-15",
          chunks: [
            {
              at: "2026-08-15T03:10:00.000Z",
              bucket: closedBucket,
              summary: "同伴主题A",
            },
          ],
        },
      },
    ]);

    let wrote = false;
    const peerCache: PeerRollCache = {
      getJson: async () => null,
      setJson: async () => {
        wrote = true;
      },
    };
    const scheduleWarm = mock((_opts: { bucket: string }) => {});

    const injects = await resolvePeerTimelineInjects({
      viewerConversationId: "viewer-1",
      config: baseConfig,
      peerCache,
      nowMs,
      agent_subject_id: 2,
      scheduleWarm,
    });

    expect(injects.length).toBe(1);
    expect(injects[0]?.content).toContain("同伴主题A");
    expect(wrote).toBe(false);
    expect(scheduleWarm).toHaveBeenCalledTimes(1);
    expect(scheduleWarm.mock.calls[0]?.[0]?.bucket).toBe(closedBucket);
  });

  it("命中缓存时用 Redis 摘要且不调度预热、不写 Redis", async () => {
    const sources = [
      {
        conversation_id: "peer-1",
        at: "2026-08-15T03:10:00.000Z",
        summary: "同伴主题A",
      },
    ];
    const fp = peerRollSourcesFp(sources);
    const key = peerRollRedisKey({
      prefix: baseConfig.redis_key_prefix,
      cst_date: "2026-08-15",
      bucket: closedBucket,
      sources_fp: fp,
    });

    listTemporalDayByCstDateMock.mockImplementation(async () => [
      {
        conversation_id: "peer-1",
        temporal_day: {
          cst_date: "2026-08-15",
          chunks: [
            {
              at: sources[0]!.at,
              bucket: closedBucket,
              summary: sources[0]!.summary,
            },
          ],
        },
      },
    ]);

    let wrote = false;
    const peerCache: PeerRollCache = {
      getJson: async <T>(k: string): Promise<T | null> => {
        if (k === key) {
          return {
            summary: "缓存合摘要",
            sources_fp: fp,
            created_at: "2026-08-15T00:00:00.000Z",
          } as T;
        }
        return null;
      },
      setJson: async () => {
        wrote = true;
      },
    };
    const scheduleWarm = mock(() => {});

    const injects = await resolvePeerTimelineInjects({
      viewerConversationId: "viewer-1",
      config: baseConfig,
      peerCache,
      nowMs,
      agent_subject_id: 2,
      scheduleWarm,
    });

    expect(injects).toEqual([expect.objectContaining({ content: "缓存合摘要" })]);
    expect(wrote).toBe(false);
    expect(scheduleWarm).not.toHaveBeenCalled();
  });
});
