import { describe, expect, it, mock, beforeEach, afterEach } from "bun:test";

import type { LimbicMemoryRow } from "@freeanima/core/repos";

import {
  DREAM_MIN_INTENSITY,
  gatherDreamInput,
  hasDreamFuel,
  limbicCreatedRange,
} from "./gather-input.ts";

const listLimbicMemoryByCreatedBetweenMock = mock(
  async (..._args: unknown[]) => [] as LimbicMemoryRow[],
);
const listConversationIdsUpdatedBetweenMock = mock(async () => ["s1"]);
const listMessagesMock = mock(async () => [
  {
    role: "user",
    content: "hello dream",
    t: "2026-06-14T12:00:00+08:00",
  },
]);

mock.module("@freeanima/core/db/pg/limbic-memory", () => ({
  listLimbicMemoryByCreatedBetween: listLimbicMemoryByCreatedBetweenMock,
}));
mock.module("@freeanima/core/db/pg/conversation", () => ({
  listConversationIdsUpdatedBetween: listConversationIdsUpdatedBetweenMock,
  listMessages: listMessagesMock,
}));

function limbicRow(id: string, intensity: number, conversationId = "s1"): LimbicMemoryRow {
  return {
    id,
    conversation_id: conversationId,
    kind: "turning_point",
    valence: -0.2,
    arousal: 0.7,
    content: `emotion ${id}`,
    intensity,
    source_segment: null,
    semantic_memory_ids: [],
    content_embedding: null,
    content_fts: null,
    fts_segmented: null,
    created_at: new Date("2026-06-14T10:00:00+08:00"),
  };
}

describe("limbicCreatedRange", () => {
  it("extends conversation-day end by 6 hours for light-sleep writes", () => {
    const range = limbicCreatedRange({
      day: "2026-06-14",
      fromIso: "2026-06-14T00:00:00+08:00",
      toIso: "2026-06-15T00:00:00+08:00",
    });
    expect(range.fromIso).toBe("2026-06-14T00:00:00+08:00");
    expect(range.toIso).toBe("2026-06-15T06:00:00+08:00");
  });
});

describe("gatherDreamInput", () => {
  beforeEach(() => {
    listLimbicMemoryByCreatedBetweenMock.mockClear();
    listConversationIdsUpdatedBetweenMock.mockClear();
    listMessagesMock.mockClear();
  });

  afterEach(() => {
    listLimbicMemoryByCreatedBetweenMock.mockClear();
    listConversationIdsUpdatedBetweenMock.mockClear();
    listMessagesMock.mockClear();
  });

  it("returns top limbic rows above intensity threshold by created_at window", async () => {
    const limbicRows = [
      limbicRow("a", 0.9),
      limbicRow("b", 0.6),
      limbicRow("c", 0.55),
      limbicRow("d", 0.4),
    ];

    listLimbicMemoryByCreatedBetweenMock.mockImplementation((async (
      fromIso: string,
      toIso: string,
      opts?: { minIntensity?: number; limit?: number },
    ) => {
      expect(fromIso).toBe("2026-06-14T00:00:00+08:00");
      expect(toIso).toBe("2026-06-15T06:00:00+08:00");
      expect(opts?.minIntensity).toBe(DREAM_MIN_INTENSITY);
      return limbicRows
        .filter((r) => r.intensity > (opts?.minIntensity ?? 0))
        .toSorted((x, y) => y.intensity - x.intensity)
        .slice(0, opts?.limit ?? 3);
    }) as never);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.limbicMemories.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(input.episodicSnippets.length).toBeGreaterThan(0);
    expect(hasDreamFuel(input)).toBe(true);
  });

  it("has no dream fuel when limbic below threshold", async () => {
    listLimbicMemoryByCreatedBetweenMock.mockImplementation((async (
      _fromIso: string,
      _toIso: string,
      opts?: { minIntensity?: number },
    ) => {
      const min = opts?.minIntensity ?? 0;
      const row = limbicRow("low", 0.3);
      return row.intensity > min ? [row] : [];
    }) as never);
    listMessagesMock.mockImplementation(async () => []);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.limbicMemories).toEqual([]);
    expect(hasDreamFuel(input)).toBe(false);
  });

  it("loads limbic even when no sessions updated that day", async () => {
    listLimbicMemoryByCreatedBetweenMock.mockImplementation(async () => [limbicRow("a", 0.8)]);
    listConversationIdsUpdatedBetweenMock.mockImplementation(async () => []);
    listMessagesMock.mockImplementation(async () => []);

    const input = await gatherDreamInput({ day: "2026-06-14" });
    expect(input.conversationIds).toEqual([]);
    expect(input.limbicMemories).toHaveLength(1);
    expect(input.episodicSnippets).toEqual([]);
    expect(hasDreamFuel(input)).toBe(true);
  });
});
