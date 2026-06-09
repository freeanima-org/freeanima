import { describe, it, expect } from "bun:test";
import type { SessionMetaLoadResult } from "@freeanima/engine-db/domain";
import { resolveSessionDeliverTargets } from "./acp-progress-delivery.ts";

function metaFixture(
  patch: Partial<Extract<SessionMetaLoadResult, { role: "session_meta" }>>,
): SessionMetaLoadResult {
  return {
    role: "session_meta",
    model: "test",
    tools: [],
    functions: [],
    timestamp: "2026-01-01T00:00:00+08:00",
    ...patch,
  };
}

describe("resolveSessionDeliverTargets", () => {
  it("discord thread 映射 chat_id 与 thread_id", () => {
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

  it("weixin 使用 chat_id", () => {
    const targets = resolveSessionDeliverTargets(
      metaFixture({
        platform: "weixin",
        platform_extra: { chat_id: "wx-user-1" },
      }),
    );
    expect(targets).toEqual([{ platform: "weixin", chat_id: "wx-user-1" }]);
  });

  it("parlor 无外部投递目标", () => {
    const targets = resolveSessionDeliverTargets(metaFixture({ platform: "parlor" }));
    expect(targets).toEqual([]);
  });
});
