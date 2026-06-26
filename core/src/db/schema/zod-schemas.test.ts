import { describe, expect, it } from "bun:test";

import { conversationSelectSchema } from "./zod-schemas.ts";

const baseRow = {
  id: "20260101_120000_ab",
  model: "test-model",
  title: null,
  cwd: null,
  systemPrompt: null,
  platformInfo: null,
  compression: null,
  todos: { items: [], next_id: 1 },
  awaitingClarify: null,
  acpTasks: null,
  goal: null,
  cachedToolsets: [],
  stagedToolsets: [],
  functions: [],
  debug: false,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
};

describe("conversationSelectSchema", () => {
  it("accepts lite meta rows without archivedAt", () => {
    expect(() => conversationSelectSchema.parse(baseRow)).not.toThrow();
  });

  it("accepts archivedAt null for active conversations", () => {
    expect(() => conversationSelectSchema.parse({ ...baseRow, archivedAt: null })).not.toThrow();
  });

  it("accepts archivedAt string for archived conversations", () => {
    expect(() =>
      conversationSelectSchema.parse({ ...baseRow, archivedAt: "2026-01-02T00:00:00Z" }),
    ).not.toThrow();
  });
});
