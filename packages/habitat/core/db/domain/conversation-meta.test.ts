import { describe, expect, it } from "bun:test";

import {
  parseAwaitingClarify,
  parseCompressionState,
  parseConversationGoal,
  parseConversationTodoStore,
  mergeCompressionKeepingSummary,
} from "./conversation-meta.ts";

describe("parseCompressionState", () => {
  it("parses valid compression JSON", () => {
    expect(parseCompressionState({ l2: 1, l3: 5, summary: "s" })).toEqual({
      l2: 1,
      l3: 5,
      summary: "s",
    });
  });

  it("returns null for invalid shape", () => {
    expect(parseCompressionState({ l2: "bad" })).toBeNull();
    expect(parseCompressionState(null)).toBeNull();
  });
});

describe("mergeCompressionKeepingSummary", () => {
  it("keeps incoming summary when present", () => {
    expect(
      mergeCompressionKeepingSummary(
        { l2: 10, l3: 12, summary: "new" },
        { l2: 8, l3: 10, summary: "old", summary_at: "a" },
      ),
    ).toEqual({ l2: 10, l3: 12, summary: "new" });
  });

  it("preserves existing summary when incoming omits it", () => {
    expect(
      mergeCompressionKeepingSummary(
        { l2: 10, l3: 12 },
        { l2: 8, l3: 10, summary: "keep me", summary_at: "2026-07-31T00:00:00+08:00" },
      ),
    ).toEqual({
      l2: 10,
      l3: 12,
      summary: "keep me",
      summary_at: "2026-07-31T00:00:00+08:00",
    });
  });

  it("does not invent summary when neither side has one", () => {
    expect(mergeCompressionKeepingSummary({ l2: 3, l3: 3 }, null)).toEqual({
      l2: 3,
      l3: 3,
    });
  });
});

describe("parseConversationTodoStore", () => {
  it("parses valid store", () => {
    expect(
      parseConversationTodoStore({
        items: [
          {
            id: 1,
            content: "write tests",
            status: "pending",
            created_at: "2026-01-01T00:00:00.000Z",
          },
        ],
        next_id: 2,
      }),
    ).toEqual({
      items: [
        {
          id: 1,
          content: "write tests",
          status: "pending",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      next_id: 2,
    });
  });

  it("returns empty default on invalid input", () => {
    expect(parseConversationTodoStore({ bad: true })).toEqual({ items: [], next_id: 1 });
  });
});

describe("parseConversationGoal", () => {
  it("parses goal with subgoals", () => {
    expect(
      parseConversationGoal({
        description: "ship feature",
        subgoals: ["write tests"],
        status: "active",
        set_at: "2026-01-01T00:00:00.000Z",
      }),
    ).toEqual({
      description: "ship feature",
      subgoals: ["write tests"],
      status: "active",
      turn_count: 0,
      max_turns: 20,
      set_at: "2026-01-01T00:00:00.000Z",
    });
  });

  it("returns null for invalid goal", () => {
    expect(parseConversationGoal({ description: "" })).toBeNull();
  });
});

describe("parseAwaitingClarify", () => {
  it("parses awaiting clarify payload", () => {
    const raw = {
      items: [{ question: "Which env?", choices: ["prod", "dev"] }],
      required: true,
      asked_at: "2026-01-01T00:00:00.000Z",
      timeout_sec: 120,
    };
    expect(parseAwaitingClarify(raw)?.items).toHaveLength(1);
  });

  it("returns null for invalid payload", () => {
    expect(parseAwaitingClarify({ items: [] })).toBeNull();
  });
});
