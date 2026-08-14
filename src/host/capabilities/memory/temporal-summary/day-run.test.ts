import { beforeEach, describe, expect, it, mock } from "bun:test";

import type { ResolvedTemporalSummaryConfig } from "./config.ts";

const listConversationIdsWithMessagesBetweenMock = mock(async () => ["s-1"]);
const collectConversationBlocksMock = mock(async () => [
  { conversation_id: "s-1", text: "user: hello\nassistant: hi" },
]);
const upsertTemporalSummaryMock = mock(async () => 42);
const summarizeTemporalTextMock = mock(async () => "当日主题摘要");

mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  listConversationIdsWithMessagesBetween: listConversationIdsWithMessagesBetweenMock,
}));
mock.module("@freeanima/host/core/db/pg/temporal-summary", () => ({
  upsertTemporalSummary: upsertTemporalSummaryMock,
}));
mock.module("../light-sleep/build-messages.ts", () => ({
  collectConversationBlocks: collectConversationBlocksMock,
  cstDayRange: (day?: string) => {
    const d = day ?? "2026-06-08";
    const [y, m, dd] = d.split("-").map(Number) as [number, number, number];
    const next = new Date(Date.UTC(y, m - 1, dd + 1));
    const to = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
    return {
      day: d,
      fromIso: `${d}T00:00:00+08:00`,
      toIso: `${to}T00:00:00+08:00`,
    };
  },
}));
mock.module("./summarize.ts", () => ({
  summarizeTemporalText: summarizeTemporalTextMock,
}));

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
    collectConversationBlocksMock.mockClear();
    collectConversationBlocksMock.mockImplementation(async () => [
      { conversation_id: "s-1", text: "user: hello\nassistant: hi" },
    ]);
    upsertTemporalSummaryMock.mockClear();
    upsertTemporalSummaryMock.mockImplementation(async () => 42);
    summarizeTemporalTextMock.mockClear();
    summarizeTemporalTextMock.mockImplementation(async () => "当日主题摘要");
  });

  it("selects conversations by message timestamp window", async () => {
    const result = await runTemporalSummaryDay({
      selfContent: "self",
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
      selfContent: "self",
      config: baseConfig,
      day: "2026-06-08",
    });
    expect(result.ok).toBe(true);
    expect(result.skipped).toBe("no_sessions");
    expect(collectConversationBlocksMock).not.toHaveBeenCalled();
    expect(upsertTemporalSummaryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        empty_reason: "no_sessions",
        content: "",
        source_count: 0,
      }),
    );
  });
});
