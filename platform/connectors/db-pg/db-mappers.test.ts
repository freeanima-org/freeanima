import { describe, expect, it } from "bun:test";
import { messageToInsert, rowToMessage } from "./session/mappers/message-mapper.ts";
import { sessionMetaToInsert } from "./session/mappers/session-mapper.ts";
import { mapCronJobRow, type CronJobDbRow } from "./cron/mappers/cron-mapper.ts";
import { mapTaskRow } from "./tasks/mappers/task-mapper.ts";
describe("db mappers", () => {
  it("sessionMetaToInsert normalizes timestamp", () => {
    const row = sessionMetaToInsert("cron_test", {
      role: "session_meta",
      model: "m",
      tools: [],
      loaded_tools: [],
      functions: [],
      timestamp: "2026-05-17T07:15:24.873+00:00",
      platform: "cron",
    });
    expect(row.createdAt).toBe("2026-05-17T07:15:24.873Z");
    expect(row.platformInfo).toEqual({ platform: "cron" });
    expect(row.loadedTools).toEqual([]);
  });

  it("cron ended_at normalized into platform_info", () => {
    const row = sessionMetaToInsert("cron_test", {
      role: "session_meta",
      model: "m",
      tools: [],
      loaded_tools: [],
      functions: [],
      timestamp: "2026-05-11T04:00:11.050Z",
      platform: "cron",
      ended_at: "2026-05-11T04:03:34.574+00:00",
    });
    expect(row.platformInfo).toEqual({
      platform: "cron",
      ended_at: "2026-05-11T04:03:34.574Z",
    });
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
      contentFts: "hi",
      ftsSegmented: null,
      contentEmbedding: null,
      createdAt: "2026-01-01T00:00:00.000Z",
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
      contentFts: null,
      ftsSegmented: null,
      contentEmbedding: null,
      createdAt: "2026-01-01T00:00:01.000Z",
    });
    expect(tool.pos).toBe(2);
  });

  // --- cron mapper ---

  const baseCronDbRow: CronJobDbRow = {
    id: "builtin-light-sleep",
    name: "light-sleep",
    schedule: "0 2 * * *",
    prompt: "",
    skills: [],
    script: null,
    noAgent: false,
    modelProvider: null,
    modelName: null,
    workdir: null,
    contextFrom: [],
    deliver: "local",
    timeoutSec: 300,
    builtin: true,
    repeat: null,
    runCount: 0,
    paused: false,
    createdAt: "2026-06-07T06:00:00.000Z",
    updatedAt: "2026-06-07T06:00:00.000Z",
    lastRunAt: null,
    lastOutputRef: null,
  };

  it("mapCronJobRow full mapping (builtin)", () => {
    const result = mapCronJobRow(baseCronDbRow);
    expect(result.id).toBe("builtin-light-sleep");
    expect(result.name).toBe("light-sleep");
    expect(result.schedule).toBe("0 2 * * *");
    expect(result.builtin).toBe(true);
    expect(result.paused).toBe(false);
    expect(result.run_count).toBe(0);
    expect(result.repeat).toBeNull();
    expect(result.skills).toEqual([]);
    expect(result.context_from).toEqual([]);
    expect(result.last_run_at).toBeNull();
    expect(result.last_output_ref).toBeNull();
    expect(result.created_at).toBe("2026-06-07T06:00:00.000Z");
  });

  it("mapCronJobRow maps last_output_ref", () => {
    const row = { ...baseCronDbRow, lastOutputRef: "cron/output/light-sleep-0003.txt" };
    const result = mapCronJobRow(row);
    expect(result.last_output_ref).toBe("cron/output/light-sleep-0003.txt");
  });

  it("mapCronJobRow maps last_run_at timestamp", () => {
    const row = { ...baseCronDbRow, lastRunAt: "2026-06-06T18:00:01.000Z" };
    const result = mapCronJobRow(row);
    expect(result.last_run_at).toBe("2026-06-06T18:00:01.000Z");
  });

  it("mapCronJobRow handles user job (non-builtin)", () => {
    const row: CronJobDbRow = {
      ...baseCronDbRow,
      id: "abc123",
      name: "Daily backup",
      builtin: false,
      repeat: 100,
      modelProvider: "openai",
      modelName: "gpt-4o",
      workdir: "/tmp",
    };
    const result = mapCronJobRow(row);
    expect(result.builtin).toBe(false);
    expect(result.repeat).toBe(100);
    expect(result.model_provider).toBe("openai");
    expect(result.model_name).toBe("gpt-4o");
    expect(result.workdir).toBe("/tmp");
  });

  it("mapTaskRow full mapping", () => {
    const result = mapTaskRow({
      id: "550e8400-e29b-41d4-a716-446655440000",
      title: "Write weekly journal",
      description: "This week summary",
      status: "pending",
      priority: "high",
      dueAt: "2026-06-10T12:00:00.000Z",
      createdAt: "2026-06-08T10:00:00.000Z",
      updatedAt: "2026-06-08T10:00:00.000Z",
      completedAt: null,
      sourceSessionId: "20260608_100000_ab12",
    });
    expect(result.id).toBe("550e8400-e29b-41d4-a716-446655440000");
    expect(result.title).toBe("Write weekly journal");
    expect(result.status).toBe("pending");
    expect(result.priority).toBe("high");
    expect(result.due_at).toBe("2026-06-10T12:00:00.000Z");
    expect(result.source_session_id).toBe("20260608_100000_ab12");
    expect(result.completed_at).toBeNull();
  });
});
