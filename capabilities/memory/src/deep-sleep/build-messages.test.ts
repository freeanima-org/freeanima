import { afterEach, describe, expect, it } from "bun:test";
import type { SemanticMemoryRow, SemanticMemoryStorePort } from "@freeanima/storage-repos";

import {
  fetchAllActiveMemories,
  formatAllMemoriesMessage,
  buildDeepSleepMessages,
} from "./build-messages.ts";
import { registerSemanticMemoryStore, resetSemanticMemoryStoreForTests } from "../semantic-port.ts";

function makeRow(id: string, status: "active" | "deprecated"): SemanticMemoryRow {
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
});
