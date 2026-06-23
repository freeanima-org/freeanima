import { describe, it, expect } from "bun:test";
import type { SessionMetaLoadResult } from "@freeanima/core/db/domain";
import { resolveSessionDeliverTargets } from "./acp-progress-delivery.ts";

function metaFixture(
  patch: Partial<Extract<SessionMetaLoadResult, { role: "session_meta" }>>,
): SessionMetaLoadResult {
  return {
    role: "session_meta",
    model: "test",
    cached_toolsets: [],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    ...patch,
  };
}

describe("resolveSessionDeliverTargets", () => {
  it("discord thread maps chat_id and thread_id", () => {
    const targets = resolveSessionDeliverTargets(
      metaFixture({
        platform: "discord",
        platform_extra: {
          channel_id: "parent-ch",
          thread_id: "thread-1",
          guild_id: "g1",
        },
      }),
    );
    expect(targets).toEqual([{ platform: "discord", chat_id: "parent-ch", thread_id: "thread-1" }]);
  });

  it("weixin uses weixin_peer_id or chat_id", () => {
    expect(
      resolveSessionDeliverTargets(
        metaFixture({
          platform: "weixin",
          platform_extra: { weixin_peer_id: "peer@im.wechat" },
        }),
      ),
    ).toEqual([{ platform: "weixin", chat_id: "peer@im.wechat" }]);

    const targets = resolveSessionDeliverTargets(
      metaFixture({
        platform: "weixin",
        platform_extra: { chat_id: "wx-user-1" },
      }),
    );
    expect(targets).toEqual([{ platform: "weixin", chat_id: "wx-user-1" }]);
  });

  it("chat has no external delivery target", () => {
    const targets = resolveSessionDeliverTargets(metaFixture({ platform: "chat" }));
    expect(targets).toEqual([]);
  });
});
