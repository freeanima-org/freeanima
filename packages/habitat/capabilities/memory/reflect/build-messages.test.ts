import { afterEach, describe, expect, it, mock } from "bun:test";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";
import { composeAutoLlmPrompt } from "@freeanima/habitat/core/llm/auto-llm-prompt";
import { PROMPT_XML_TAGS } from "@freeanima/habitat/core/hooks/prompt";

import {
  fetchAllActiveMemories,
  formatAllMemoriesMessage,
  rowToJsonCompact,
  hasRecentMemoryUpdates,
  isMemoryUpdatedSince,
  shouldTrimPinned,
  REFLECT_CONSOLIDATE_TASK_SPEC,
  REFLECT_CONSOLIDATE_PIN_TASK_SPEC,
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

describe("reflect build-messages", () => {
  afterEach(() => {
    listActiveSemanticMemoryMock.mockClear();
  });

  it("formatAllMemoriesMessage reports active row count in heading", () => {
    const active = [makeRow(96085, "active"), makeRow(14119, "active")];
    const { text } = formatAllMemoriesMessage(active);
    expect(text).toContain("# All semantic memories (2 active entries)");
  });

  it("rowToJsonCompact only includes consolidate-useful fields", () => {
    const row = makeRow(7, "active", {
      pinned: true,
      source_conversations: ["c1"],
      occurred_at: "2024 summer",
      reference_count: 99,
      source: { conversation_id: "c1", message_ids: ["m1"] },
      links: [{ type: "merged_from", memory_id: 1 }],
    });
    const json = JSON.parse(rowToJsonCompact(row)) as Record<string, unknown>;
    expect(json).toEqual({
      id: 7,
      type: "world",
      content: "memory 7",
      source_conversations: ["c1"],
      observed: "2026-06-12T10:00:00",
      occurred: "2024 summer",
    });
    expect(json).not.toHaveProperty("pinned");
    expect(json).not.toHaveProperty("updated_at");
    expect(json).not.toHaveProperty("created_at");
    expect(json).not.toHaveProperty("reference_count");
    expect(json).not.toHaveProperty("sources");
    expect(json).not.toHaveProperty("source");
    expect(json).not.toHaveProperty("links");
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

  it("REFLECT_CONSOLIDATE_TASK_SPEC has ordered steps and forbids adding pins", () => {
    expect(REFLECT_CONSOLIDATE_TASK_SPEC).toContain("Reflect consolidate (single pass)");
    expect(REFLECT_CONSOLIDATE_TASK_SPEC).toContain("Mandatory planning order");
    expect(REFLECT_CONSOLIDATE_TASK_SPEC).toContain("Contradiction + expiry");
    expect(REFLECT_CONSOLIDATE_TASK_SPEC).toContain("SINGLE assistant response");
    expect(REFLECT_CONSOLIDATE_TASK_SPEC).toContain("memory_semantic_merge");
    expect(REFLECT_CONSOLIDATE_TASK_SPEC).not.toContain("Pin maintenance");
    expect(REFLECT_CONSOLIDATE_TASK_SPEC).toContain("must **not** add pins");
  });

  it("REFLECT_CONSOLIDATE_PIN_TASK_SPEC is unpin-only over limit", () => {
    expect(REFLECT_CONSOLIDATE_PIN_TASK_SPEC).toContain("Reflect pin trim");
    expect(REFLECT_CONSOLIDATE_PIN_TASK_SPEC).toContain("{{pinned_count}}");
    expect(REFLECT_CONSOLIDATE_PIN_TASK_SPEC).toContain("{{pinned_max}}");
    expect(REFLECT_CONSOLIDATE_PIN_TASK_SPEC).toContain("pinned: false");
    expect(REFLECT_CONSOLIDATE_PIN_TASK_SPEC).toContain("never `pinned: true`");
    expect(REFLECT_CONSOLIDATE_PIN_TASK_SPEC).toContain(
      "Do not create, merge, split, or deprecate",
    );
  });

  it("composeAutoLlmPrompt for reflect uses only semantic_memories data part", () => {
    const { text } = formatAllMemoriesMessage([makeRow(1, "active")]);
    const { systemPrompt, userMessages } = composeAutoLlmPrompt({
      kind: "memory-reflect",
      taskSpec: REFLECT_CONSOLIDATE_TASK_SPEC,
      dataParts: [{ tag: PROMPT_XML_TAGS.semanticMemories, body: text }],
    });
    expect(systemPrompt).toContain("Reflect consolidate");
    expect(userMessages).toHaveLength(1);
    expect(userMessages[0]).toContain(`<${PROMPT_XML_TAGS.semanticMemories}>`);
    expect(userMessages.join("\n")).not.toContain("No pre-screen");
    expect(userMessages.join("\n")).not.toContain("Incremental changes");
  });

  it("composeAutoLlmPrompt for pin trim includes task_params", () => {
    const { text } = formatAllMemoriesMessage([makeRow(1, "active", { pinned: true })]);
    const { userMessages } = composeAutoLlmPrompt({
      kind: "memory-reflect",
      taskSpec: REFLECT_CONSOLIDATE_PIN_TASK_SPEC,
      taskParams: { pinned_count: 25, pinned_max: 20 },
      dataParts: [{ tag: PROMPT_XML_TAGS.semanticMemories, body: text }],
    });
    expect(userMessages.length).toBe(2);
    expect(userMessages[0]).toContain("pinned_count: 25");
    expect(userMessages[0]).toContain("pinned_max: 20");
    expect(userMessages[1]).toContain(`<${PROMPT_XML_TAGS.semanticMemories}>`);
  });

  it("shouldTrimPinned only when over max", () => {
    expect(shouldTrimPinned(20, 20)).toBe(false);
    expect(shouldTrimPinned(19, 20)).toBe(false);
    expect(shouldTrimPinned(21, 20)).toBe(true);
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
