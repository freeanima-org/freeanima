import { describe, expect, it } from "bun:test";
import { cronJobs } from "@freeanima/habitat/core/db/schema";

import { messageToInsert, rowToMessage } from "./conversation/message-transform.ts";
import { conversationMetaToInsert } from "./conversation/transform.ts";

describe("db transforms", () => {
  it("conversationMetaToInsert normalizes timestamp", () => {
    const row = conversationMetaToInsert("chat_test", {
      model: "m",
      cached_toolsets: [],
      staged_toolsets: [],
      functions: [],
      timestamp: "2026-05-17T07:15:24.873+00:00",
      platform: "chat",
    });
    expect(row.created_at).toEqual(new Date("2026-05-17T07:15:24.873Z"));
    expect(row.platform_info).toEqual({ platform: "chat" });
    expect(row.staged_toolsets).toEqual([]);
  });

  it("unknown / cron platform_info becomes null", () => {
    const row = conversationMetaToInsert("legacy_cron", {
      model: "m",
      cached_toolsets: [],
      staged_toolsets: [],
      functions: [],
      timestamp: "2026-05-11T04:00:11.050Z",
      platform: "cron",
      ended_at: "2026-05-11T04:03:34.574+00:00",
    });
    expect(row.platform_info).toBeNull();
  });

  it("conversationMetaToInsert stores scenario on column not platform_info", () => {
    const row = conversationMetaToInsert("coding_sess", {
      model: "m",
      cached_toolsets: [],
      staged_toolsets: [],
      functions: [],
      timestamp: "2026-05-17T07:15:24.873Z",
      platform: "coding",
      scenario: "coding_agent",
      platform_extra: {
        outpost_app_id: "coding",
        outpost_instance_id: "inst1",
      },
    });
    expect(row.scenario).toBe("coding_agent");
    expect(row.platform_info).toEqual({
      platform: "coding",
      outpost_app_id: "coding",
      outpost_instance_id: "inst1",
    });
    expect(row.platform_info).not.toHaveProperty("scenario");
  });

  it("message payload round-trip user / tool", () => {
    const userInsert = messageToInsert("sess", {
      role: "user",
      content: "hi",
      pos: 1,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(userInsert.pos).toBe(1);
    expect(userInsert.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(userInsert.payload).toMatchObject({ role: "user", content: "hi" });
    expect(userInsert.payload).not.toHaveProperty("pos");
    const user = rowToMessage({
      ...userInsert,
      content_fts: "hi",
      fts_segmented: null,
      content_embedding: null,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(user.pos).toBe(1);

    const toolInsert = messageToInsert("sess", {
      role: "tool",
      tool_call_id: "call_1",
      content: '{"ok":true}',
      pos: 2,
      timestamp: "2026-01-01T00:00:01.000Z",
    });
    expect(toolInsert.pos).toBe(2);
    expect(toolInsert.payload.role).toBe("tool");
    const tool = rowToMessage({
      ...toolInsert,
      content_fts: null,
      fts_segmented: null,
      content_embedding: null,
      created_at: "2026-01-01T00:00:01.000Z",
    });
    expect(tool.pos).toBe(2);
  });

  type CronJobDbRow = typeof cronJobs.$inferSelect;

  const baseCronDbRow: CronJobDbRow = {
    id: "builtin-memory-maintenance",
    name: "memory-maintenance",
    schedule: "0 2 * * *",
    prompt: "",
    skills: [],
    script: null,
    no_agent: false,
    model_provider: null,
    model_name: null,
    workdir: null,
    context_from: [],
    timeout_sec: 300,
    builtin: true,
    repeat: null,
    run_count: 0,
    paused: false,
    created_at: new Date("2026-06-07T06:00:00.000Z"),
    updated_at: new Date("2026-06-07T06:00:00.000Z"),
    last_run_at: null,
    last_output_ref: null,
    notify_on_success: false,
    allowed_tools: [],
    denied_tools: [],
  };

  it("cron row inferSelect shape (builtin)", () => {
    const result = baseCronDbRow;
    expect(result.id).toBe("builtin-memory-maintenance");
    expect(result.created_at).toEqual(new Date("2026-06-07T06:00:00.000Z"));
    expect(result.last_run_at).toBeNull();
  });

  it("cron row last_output_ref", () => {
    const row = { ...baseCronDbRow, last_output_ref: "cron/output/memory-maintenance-0003.txt" };
    expect(row.last_output_ref).toBe("cron/output/memory-maintenance-0003.txt");
  });

  it("cron row last_run_at as Date", () => {
    const row = { ...baseCronDbRow, last_run_at: new Date("2026-06-06T18:00:01.000Z") };
    expect(row.last_run_at).toEqual(new Date("2026-06-06T18:00:01.000Z"));
  });
});
