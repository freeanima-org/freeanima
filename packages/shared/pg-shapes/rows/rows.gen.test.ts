import { describe, expect, test } from "bun:test";

import {
  conversationInsertSchema,
  conversationSelectSchema,
  messageInsertSchema,
  messageSelectSchema,
} from "./index.ts";

describe("pg-shapes generated rows", () => {
  test("message select requires payload shape", () => {
    const parsed = messageSelectSchema.parse({
      id: "m1",
      conversation_id: "c1",
      subject_id: 2,
      pos: 1,
      payload: { role: "user", content: "hi" },
    });
    expect(parsed.pos).toBe(1);
  });

  test("message insert matches select required columns", () => {
    expect(
      messageInsertSchema.safeParse({
        id: "m1",
        conversation_id: "c1",
        subject_id: 2,
        pos: 0,
        payload: { role: "user", content: "x" },
      }).success,
    ).toBe(true);
  });

  test("conversation select nullability and scenario enum", () => {
    const row = conversationSelectSchema.parse({
      id: "c1",
      model: "m",
      title: null,
      cwd: null,
      system_prompt: null,
      platform_info: null,
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
      created_at: new Date(),
      updated_at: new Date(),
    });
    expect(row.title).toBeNull();
    expect(conversationSelectSchema.safeParse({ ...row, scenario: "digital_human" }).success).toBe(
      true,
    );
    expect(conversationSelectSchema.safeParse({ ...row, scenario: "coding_agent" }).success).toBe(
      true,
    );
    expect(conversationSelectSchema.safeParse({ ...row, scenario: "nope" }).success).toBe(false);
  });

  test("conversation insert optional defaults for debug", () => {
    const r = conversationInsertSchema.safeParse({
      id: "c1",
      model: "m",
      agent_subject_id: 1,
      todos: { items: [], next_id: 1 },
      cached_toolsets: [],
      staged_toolsets: [],
      functions: [],
      created_at: new Date(),
      updated_at: new Date(),
      platform_info: null,
      compression: null,
      temporal_day: null,
      awaiting_clarify: null,
      acp_tasks: null,
      goal: null,
    });
    expect(r.success).toBe(true);
  });
});
