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
  scenario: null,
  agent_subject_id: 1,
  agent_public_id: null,
  room_id: null,
  last_projected_room_seq: 0,
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

  it("accepts pinnedAt null / string", () => {
    expect(() => conversationSelectSchema.parse({ ...baseRow, pinned_at: null })).not.toThrow();
    expect(() =>
      conversationSelectSchema.parse({ ...baseRow, pinned_at: "2026-01-02T00:00:00Z" }),
    ).not.toThrow();
  });

  it("accepts flat companion platform_info on select", () => {
    const parsed = conversationSelectSchema.parse({
      ...baseRow,
      platform_info: {
        platform: "companion",
        outpost_app_id: "companion",
        outpost_instance_id: "k7m",
      },
    });
    expect(parsed.platform_info).toMatchObject({
      platform: "companion",
      outpost_instance_id: "k7m",
    });
  });

  it("rejects legacy sap: platform_info on select", () => {
    expect(() =>
      conversationSelectSchema.parse({
        ...baseRow,
        platform_info: { platform: "sap:companion:k7m" },
      }),
    ).toThrow();
  });
});
