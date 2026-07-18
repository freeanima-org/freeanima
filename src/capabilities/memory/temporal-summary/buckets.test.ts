import { describe, expect, it } from "bun:test";

import {
  injectTemporalPeerRollups,
  peerRollRedisKey,
  peerRollSourcesFp,
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
    expect(messages[3]?.role).toBe("user");
  });
});
