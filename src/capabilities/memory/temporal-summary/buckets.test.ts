import { describe, expect, it } from "bun:test";

import {
  injectTemporalPeerRollups,
  listClosedBucketsToday,
  peerRollRedisKey,
  peerRollSourcesFp,
  temporalBucketEndIso,
  temporalBucketStartIso,
  type TimelinePeerInject,
} from "./index.ts";
import type { StoredMessage } from "@freeanima/core/db/domain";

describe("temporal-summary buckets", () => {
  it("formats half-hour bucket start in CST", () => {
    // 2026-07-18 06:15 CST = 2026-07-17 22:15 UTC
    const ms = Date.parse("2026-07-17T22:15:00.000Z");
    expect(temporalBucketStartIso(ms)).toBe("2026-07-18T06:00+08:00");
  });

  it("temporalBucketEndIso is start + 30min in CST (not UTC Z relabeled as +08:00)", () => {
    const start = "2026-07-18T06:00+08:00";
    const end = temporalBucketEndIso(start);
    expect(end).toBe("2026-07-18T06:30+08:00");
    expect(Date.parse(end) - Date.parse(start)).toBe(30 * 60 * 1000);
  });

  it("listClosedBucketsToday uses correct bucket end (not −8h)", () => {
    // 2026-07-18 07:00 CST = 2026-07-17 23:00 UTC → 06:00 与 06:30 已闭合，07:00 未闭合
    const nowMs = Date.parse("2026-07-17T23:00:00.000Z");
    const closed = listClosedBucketsToday(nowMs);
    expect(closed).toContain("2026-07-18T06:00+08:00");
    expect(closed).toContain("2026-07-18T06:30+08:00");
    expect(closed).not.toContain("2026-07-18T07:00+08:00");
    // 旧 bug：end 早 8h 会把 14:00+ 也算闭合；此处不应出现下午桶
    expect(closed).not.toContain("2026-07-18T14:00+08:00");
  });

  it("peerRollSourcesFp is order-independent for same set", () => {
    const a = peerRollSourcesFp([
      { conversation_id: "b", at: "2", summary: "B" },
      { conversation_id: "a", at: "1", summary: "A" },
    ]);
    const b = peerRollSourcesFp([
      { conversation_id: "a", at: "1", summary: "A" },
      { conversation_id: "b", at: "2", summary: "B" },
    ]);
    expect(a).toBe(b);
    expect(a.length).toBe(16);
  });

  it("builds redis key", () => {
    const key = peerRollRedisKey({
      prefix: "anima:temporal",
      cst_date: "2026-07-18",
      bucket: "2026-07-18T06:00+08:00",
      sources_fp: "abcd",
    });
    expect(key).toContain("peer_roll");
    expect(key).toContain("abcd");
  });
});

describe("timeline inject", () => {
  it("inserts one peer block at chronological position without rewriting history prefix order", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "hi", timestamp: "2026-07-18T05:00:00.000Z" },
      { role: "assistant", content: "hello", timestamp: "2026-07-18T05:01:00.000Z" },
      { role: "user", content: "later", timestamp: "2026-07-18T07:00:00.000Z" },
    ];
    const injects: TimelinePeerInject[] = [
      { at: "2026-07-18T06:30:00.000Z", content: "peers at 6:30" },
    ];
    injectTemporalPeerRollups(messages, injects);
    expect(messages.length).toBe(4);
    expect(messages[0]?.role).toBe("user");
    expect(messages[1]?.role).toBe("assistant");
    expect(messages[2]?.role).toBe("assistant");
    expect(messages[2] && "name" in messages[2] ? messages[2].name : "").toBe(
      "temporal_summary_peers",
    );
    expect(messages[2] && "timestamp" in messages[2] ? messages[2].timestamp : "").toBe(
      "2026-07-18T06:30:00.000Z",
    );
    expect(messages[3]?.role).toBe("user");
  });

  it("keeps multi-bucket injects chronological when they share the same message gap", () => {
    const messages: StoredMessage[] = [
      { role: "user", content: "hi", timestamp: "2026-07-18T05:00:00.000Z" },
      { role: "user", content: "later", timestamp: "2026-07-18T08:00:00.000Z" },
    ];
    const injects: TimelinePeerInject[] = [
      { at: "2026-07-18T07:00:00.000Z", content: "later peers" },
      { at: "2026-07-18T06:00:00.000Z", content: "earlier peers" },
    ];
    injectTemporalPeerRollups(messages, injects);
    expect(messages.length).toBe(4);
    const names = messages.map((m) => ("name" in m ? m.name : undefined));
    expect(names[1]).toBe("temporal_summary_peers");
    expect(names[2]).toBe("temporal_summary_peers");
    expect(messages[1] && "timestamp" in messages[1] ? messages[1].timestamp : "").toBe(
      "2026-07-18T06:00:00.000Z",
    );
    expect(messages[2] && "timestamp" in messages[2] ? messages[2].timestamp : "").toBe(
      "2026-07-18T07:00:00.000Z",
    );
  });

  it("never inserts peer block before leading system prompt", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "global system" },
      { role: "user", content: "hi", timestamp: "2026-07-18T07:00:00.000Z" },
    ];
    const injects: TimelinePeerInject[] = [
      // at 早于任何带时间戳消息 → 旧逻辑会 splice(0)，盖住 system
      { at: "2026-07-18T01:00:00.000Z", content: "early peers" },
    ];
    injectTemporalPeerRollups(messages, injects);
    expect(messages[0]?.role).toBe("system");
    expect(messages[1]?.role).toBe("assistant");
    expect(messages[1] && "name" in messages[1] ? messages[1].name : "").toBe(
      "temporal_summary_peers",
    );
    expect(messages[2]?.role).toBe("user");
  });
});
