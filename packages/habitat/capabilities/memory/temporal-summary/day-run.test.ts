import { afterAll, beforeEach, describe, expect, it, mock } from "bun:test";

import type { ResolvedTemporalSummaryConfig } from "./config.ts";

const listConversationIdsWithMessagesBetweenMock = mock(async () => ["s-1"]);
const getConversationMetaLiteMock = mock(async () => ({
  model: "test",
  title: "Test",
  platform: "chat",
  timestamp: "2026-06-08T10:00:00+08:00",
}));
const listMessagesMock = mock(async () => [
  { role: "user", content: "hello", timestamp: "2026-06-08T10:00:00+08:00" },
  { role: "assistant", content: "hi", timestamp: "2026-06-08T10:01:00+08:00" },
]);
const upsertTemporalSummaryMock = mock(async () => 42);
const summarizeTemporalTextMock = mock(async () => "当日主题摘要");

const conversationOriginal = await import("@freeanima/habitat/core/db/pg/conversation");
const temporalSummaryOriginal = await import("@freeanima/habitat/core/db/pg/temporal-summary");
const summarizeOriginal = await import("./summarize.ts");

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  ...conversationOriginal,
  listConversationIdsWithMessagesBetween: listConversationIdsWithMessagesBetweenMock,
  getConversationMetaLite: getConversationMetaLiteMock,
  listMessages: listMessagesMock,
}));
mock.module("@freeanima/habitat/core/db/pg/temporal-summary", () => ({
  ...temporalSummaryOriginal,
  upsertTemporalSummary: upsertTemporalSummaryMock,
}));
mock.module("./summarize.ts", () => ({
  ...summarizeOriginal,
  summarizeTemporalText: summarizeTemporalTextMock,
}));

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg/conversation", () => conversationOriginal);
  mock.module("@freeanima/habitat/core/db/pg/temporal-summary", () => temporalSummaryOriginal);
  mock.module("./summarize.ts", () => summarizeOriginal);
});

const { runTemporalSummaryDay } = await import("./day-run.ts");

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

describe("runTemporalSummaryDay", () => {
  beforeEach(() => {
    listConversationIdsWithMessagesBetweenMock.mockClear();
    listConversationIdsWithMessagesBetweenMock.mockImplementation(async () => ["s-1"]);
    getConversationMetaLiteMock.mockClear();
    getConversationMetaLiteMock.mockImplementation(async () => ({
      model: "test",
      title: "Test",
      platform: "chat",
      timestamp: "2026-06-08T10:00:00+08:00",
    }));
    listMessagesMock.mockClear();
    listMessagesMock.mockImplementation(async () => [
      { role: "user", content: "hello", timestamp: "2026-06-08T10:00:00+08:00" },
      { role: "assistant", content: "hi", timestamp: "2026-06-08T10:01:00+08:00" },
    ]);
    upsertTemporalSummaryMock.mockClear();
    upsertTemporalSummaryMock.mockImplementation(async () => 42);
    summarizeTemporalTextMock.mockClear();
    summarizeTemporalTextMock.mockImplementation(async () => "当日主题摘要");
  });

  it("selects conversations by message timestamp window", async () => {
    const result = await runTemporalSummaryDay({
      config: baseConfig,
      day: "2026-06-08",
    });
    expect(listConversationIdsWithMessagesBetweenMock).toHaveBeenCalledWith(
      "2026-06-08T00:00:00+08:00",
      "2026-06-09T00:00:00+08:00",
    );
    expect(result.ok).toBe(true);
    expect(result.entity_id).toBe(42);
    expect(result.skipped).toBeUndefined();
    expect(upsertTemporalSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        window: "day",
        period_start: "2026-06-08",
        content: "当日主题摘要",
        empty_reason: null,
        source_count: 1,
      }),
    );
  });

  it("writes no_sessions when no message activity that day", async () => {
    listConversationIdsWithMessagesBetweenMock.mockImplementation(async () => []);
    const result = await runTemporalSummaryDay({
      config: baseConfig,
      day: "2026-06-08",
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe("no_sessions");
    expect(listMessagesMock).not.toHaveBeenCalled();
    expect(upsertTemporalSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        empty_reason: "no_sessions",
        content: "",
        source_count: 0,
      }),
    );
  });
});
