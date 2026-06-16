import { afterEach, describe, expect, it } from "bun:test";
import type { SemanticMemoryRow, SemanticMemoryStorePort } from "@freeanima/core/repos";

import {
  fetchAllActiveMemories,
  formatAllMemoriesMessage,
  buildDeepSleepMessages,
  filterSplitCandidates,
  formatSplitCandidatesMessage,
  hasRecentMemoryUpdates,
  isMemoryUpdatedSince,
} from "./build-messages.ts";
import { registerSemanticMemoryStore, resetSemanticMemoryStoreForTests } from "../semantic-port.ts";

function makeRow(
  id: string,
  status: "active" | "deprecated",
  overrides?: Partial<SemanticMemoryRow>,
): SemanticMemoryRow {
  const now = "2026-06-12T10:00:00.000Z";
  return {
    id,
    type: "world",
    pinned: false,
    content: `memory ${id}`,
    source_sessions: [],
    observed_at: now,
    occurred_at: null,
    status,
    reference_count: 0,
    created: now,
    updated: now,
    ...overrides,
  };
}

function createMockStore(rows: SemanticMemoryRow[]): SemanticMemoryStorePort {
  return {
    async create() {
      return "new";
    },
    async get() {
      return null;
    },
    async update() {},
    async deprecate() {
      return false;
    },
    async delete() {
      return false;
    },
    async count() {
      return rows.filter((r) => r.status === "active").length;
    },
    async listResident() {
      return rows.filter((r) => r.status === "active");
    },
    async listAll() {
      return rows;
    },
    async listActive() {
      return rows.filter((r) => r.status === "active");
    },
    async listBySourceSessions() {
      return [];
    },
    async searchFts() {
      return [];
    },
    async search() {
      return [];
    },
    async countSearch() {
      return 0;
    },
    async findByContent() {
      return null;
    },
  };
}

describe("deep sleep build-messages", () => {
  afterEach(() => {
    resetSemanticMemoryStoreForTests();
  });

  it("formatAllMemoriesMessage reports active row count in heading", () => {
    const active = [makeRow("a-1", "active"), makeRow("a-2", "active")];
    const { text } = formatAllMemoriesMessage(active);
    expect(text).toContain("# All semantic memories (2 active entries)");
  });

  it("fetchAllActiveMemories uses listActive and excludes deprecated rows", async () => {
    const rows = [makeRow("a-1", "active"), makeRow("a-2", "active"), makeRow("d-1", "deprecated")];
    registerSemanticMemoryStore(createMockStore(rows));

    const result = await fetchAllActiveMemories();
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.status === "active")).toBe(true);

    const { text } = formatAllMemoriesMessage(result);
    expect(text).toContain("# All semantic memories (2 active entries)");
  });

  it("buildDeepSleepMessages includes pin_maintenance round instructions", () => {
    const active = [makeRow("a-1", "active")];
    const { instructionText } = buildDeepSleepMessages(active, "pin_maintenance", {
      entries: {},
      addedIds: [],
      modifiedIds: [],
      deprecatedIds: [],
    });
    expect(instructionText).toContain("round 4: pin maintenance");
    expect(instructionText).toContain("memory_semantic_update");
  });

  it("buildDeepSleepMessages split round uses candidate heading", () => {
    const longContent = "Alice lives in Shanghai. She works at Tencent. She likes Python.";
    const candidate = makeRow("a-1", "active", { content: longContent });
    const { allMemoriesText, instructionText } = buildDeepSleepMessages(
      [candidate],
      "split",
      { entries: {}, addedIds: [], modifiedIds: [], deprecatedIds: [] },
      { splitTotalActive: 5 },
    );
    expect(allMemoriesText).toContain("# Split candidates (1 of 5 active entries)");
    expect(instructionText).toContain("split candidates in message 1");
  });

  it("filterSplitCandidates excludes short single-sentence entries", () => {
    const short = makeRow("a-1", "active", { content: "short fact" });
    const long = makeRow("a-2", "active", {
      content: "Alice lives in Shanghai. She works at Tencent and likes Python very much.",
      updated: "2026-06-12T10:00:00.000Z",
    });
    const now = new Date("2026-06-12T12:00:00.000Z");
    expect(filterSplitCandidates([short, long], "full", now)).toEqual([long]);
  });

  it("filterSplitCandidates incremental requires recent updated", () => {
    const recent = makeRow("a-1", "active", {
      content: "First fact here. Second fact there. Third fact also included for length.",
      updated: "2026-06-12T11:00:00.000Z",
    });
    const stale = makeRow("a-2", "active", {
      content: "Old fact one. Old fact two. Old fact three with enough length here.",
      updated: "2026-06-01T10:00:00.000Z",
      observed_at: "2026-06-12T11:00:00.000Z",
    });
    const now = new Date("2026-06-12T12:00:00.000Z");
    expect(filterSplitCandidates([recent, stale], "incremental", now)).toEqual([recent]);
  });

  it("hasRecentMemoryUpdates uses updated only", () => {
    const now = new Date("2026-06-12T12:00:00.000Z");
    const recent = makeRow("a-1", "active", { updated: "2026-06-12T11:00:00.000Z" });
    const staleObserved = makeRow("a-2", "active", {
      updated: "2026-06-01T10:00:00.000Z",
      observed_at: "2026-06-12T11:00:00.000Z",
    });
    expect(hasRecentMemoryUpdates([staleObserved], now)).toBe(false);
    expect(hasRecentMemoryUpdates([recent], now)).toBe(true);
    expect(isMemoryUpdatedSince(recent, new Date("2026-06-12T10:00:00.000Z"))).toBe(true);
  });

  it("formatSplitCandidatesMessage reports candidate vs total counts", () => {
    const candidate = makeRow("a-1", "active", {
      content: "Line one. Line two. Line three with enough length.",
    });
    const { text } = formatSplitCandidatesMessage([candidate], 10);
    expect(text).toContain("# Split candidates (1 of 10 active entries)");
  });
});
