import { afterEach, describe, expect, it, mock } from "bun:test";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import {
  fetchAllActiveMemories,
  formatAllMemoriesMessage,
  buildDeepSleepMessages,
  hasRecentMemoryUpdates,
  isMemoryUpdatedSince,
  batchHasPinned,
} from "./build-messages.ts";

const listActiveSemanticMemoryMock = mock(async () => [] as SemanticMemoryRow[]);

mock.module("@freeanima/habitat/core/db/pg/semantic-memory", () => ({
  listActiveSemanticMemory: listActiveSemanticMemoryMock,
}));

function makeRow(
  id: number,
  status: "active" | "deprecated",
  overrides?: Partial<SemanticMemoryRow>,
): SemanticMemoryRow {
  const now = new Date("2026-06-12T10:00:00.000Z");
  return {
    id,
    type: "world",
    pinned: false,
    content: `memory ${id}`,
    source_conversations: [],
    observed_at: now,
    occurred_at: null,
    status,
    reference_count: 0,
    world_id: 1,
    created_at: now,
    updated_at: now,
    ...overrides,
  };
}

const emptyLog = {
  entries: {},
  addedIds: [] as string[],
  modifiedIds: [] as string[],
  deprecatedIds: [] as string[],
};

describe("deep sleep build-messages", () => {
  afterEach(() => {
    listActiveSemanticMemoryMock.mockClear();
  });

  it("formatAllMemoriesMessage reports active row count in heading", () => {
    const active = [makeRow(96085, "active"), makeRow(14119, "active")];
    const { text } = formatAllMemoriesMessage(active);
    expect(text).toContain("# All semantic memories (2 active entries)");
  });

  it("fetchAllActiveMemories uses listActive and excludes deprecated rows", async () => {
    const rows = [makeRow(96085, "active"), makeRow(14119, "active"), makeRow(95605, "deprecated")];
    listActiveSemanticMemoryMock.mockImplementation(async () =>
      rows.filter((r) => r.status === "active"),
    );

    const result = await fetchAllActiveMemories();
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "active")).toBe(true);

    const { text } = formatAllMemoriesMessage(result);
    expect(text).toContain("# All semantic memories (2 active entries)");
  });

  it("buildDeepSleepMessages consolidate includes ordered steps and batch toolcalls", () => {
    const active = [makeRow(96085, "active")];
    const { instructionText, allMemoriesText } = buildDeepSleepMessages(
      active,
      "consolidate",
      emptyLog,
    );
    expect(allMemoriesText).toContain("# All semantic memories (1 active entries)");
    expect(instructionText).toContain("Reflect consolidate (single pass)");
    expect(instructionText).toContain("Mandatory planning order");
    expect(instructionText).toContain("Contradiction + expiry");
    expect(instructionText).toContain("SINGLE assistant response");
    expect(instructionText).toContain("memory_semantic_merge");
  });

  it("buildDeepSleepMessages consolidate_pin is pin-only", () => {
    const active = [makeRow(96085, "active", { pinned: true })];
    const { instructionText } = buildDeepSleepMessages(active, "consolidate_pin", emptyLog);
    expect(instructionText).toContain("Reflect consolidate (pin-only)");
    expect(instructionText).toContain("Do not create, merge, split, or deprecate");
    expect(instructionText).toContain("SINGLE assistant response");
  });

  it("batchHasPinned detects pinned rows", () => {
    expect(batchHasPinned([makeRow(1, "active")])).toBe(false);
    expect(batchHasPinned([makeRow(1, "active", { pinned: true })])).toBe(true);
  });

  it("hasRecentMemoryUpdates uses updated only", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");
    const recent = makeRow(96085, "active", { updated_at: new Date("2026-06-12T11:00:00.000Z") });
    const staleObserved = makeRow(14119, "active", {
      updated_at: new Date("2026-06-01T10:00:00.000Z"),
      observed_at: new Date("2026-06-12T11:00:00.000Z"),
    });
    expect(hasRecentMemoryUpdates([staleObserved], now)).toBe(false);
    expect(hasRecentMemoryUpdates([recent], now)).toBe(true);
    expect(isMemoryUpdatedSince(recent, new Date("2026-06-12T10:00:00.000Z"))).toBe(true);
  });
});
