import { describe, expect, it } from "bun:test";

import { conversationSelectSchema } from "./zod-schemas.ts";

const baseRow = {
  id: "20260101_120000_ab",
  model: "test-model",
  title: null,
  cwd: null,
  system_prompt: null,
  system_prompt_built_at: null,
  platform_info: null,
  module: null,
  compression: null,
  temporal_day: null,
  todos: { items: [], next_id: 1 },
  awaiting_clarify: null,
  acp_tasks: null,
  goal: null,
  cached_toolsets: [],
  staged_toolsets: [],
  functions: [],
  debug: false,
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-01T00:00:00Z",
};

describe("conversationSelectSchema", () => {
  it("accepts lite meta rows without archivedAt", () => {
    expect(() => conversationSelectSchema.parse(baseRow)).not.toThrow();
  });

  it("accepts archivedAt null for active conversations", () => {
    expect(() => conversationSelectSchema.parse({ ...baseRow, archived_at: null })).not.toThrow();
  });

  it("accepts archivedAt string for archived conversations", () => {
    expect(() =>
      conversationSelectSchema.parse({ ...baseRow, archived_at: "2026-01-02T00:00:00Z" }),
    ).not.toThrow();
  });
});
