import { describe, expect, it } from "bun:test";
import type { SemanticMemoryRow } from "@freeanima/habitat/core/db/schema/rows";

import { formatExistingMemoriesMessage, RETAIN_TASK_SPEC } from "./build-messages.ts";

function row(
  overrides: Partial<SemanticMemoryRow> & { id: number; content: string },
): SemanticMemoryRow {
  const now = new Date("2026-08-16T08:00:00.000Z");
  return {
    type: "world",
    pinned: false,
    source_conversations: ["conv-1"],
    observed_at: now,
    occurred_at: "2026-08-15",
    status: "active",
    reference_count: 0,
    created_at: now,
    updated_at: now,
    world_id: 1,
    ...overrides,
  };
}

describe("formatExistingMemoriesMessage", () => {
  it("renders organize XML memory items", () => {
    const text = formatExistingMemoriesMessage([row({ id: 18666, content: "肌肉酸痛" })]);
    expect(text).toBe(
      '<memory id="18666" type="world" sources="conv-1" observed="2026-08-16T08:00:00" occurred="2026-08-15">肌肉酸痛</memory>',
    );
  });

  it("empty list is empty string", () => {
    expect(formatExistingMemoriesMessage([])).toBe("");
  });
});

describe("RETAIN_TASK_SPEC", () => {
  it("asks to distinguish speaker role", () => {
    expect(RETAIN_TASK_SPEC).toContain("role");
    expect(RETAIN_TASK_SPEC).toContain("<memory>");
  });
});
