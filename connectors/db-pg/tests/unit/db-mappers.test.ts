import { describe, expect, it } from "bun:test";
import { messageToInsert, rowToMessage } from "../../src/session/mappers/message-mapper.ts";
import { sessionMetaToInsert } from "../../src/session/mappers/session-mapper.ts";
import { mapCronJobRow, type CronJobDbRow } from "../../src/cron/mappers/cron-mapper.ts";
describe("db mappers", () => {
  it("sessionMetaToInsert 规范化 timestamp", () => {
    const row = sessionMetaToInsert("cron_test", {
      role: "session_meta",
      model: "m",
      tools: [],
      functions: [],
      timestamp: "2026-05-17T07:15:24.873+00:00",
      platform: "cron",
    });
    expect(row.createdAt).toBe("2026-05-17T07:15:24.873Z");
    expect(row.platformInfo).toEqual({ platform: "cron" });
  });

  it("cron ended_at 规范化进 platform_info", () => {
    const row = sessionMetaToInsert("cron_test", {
      role: "session_meta",
      model: "m",
      tools: [],
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

  it("message payload 往返 user / tool", () => {
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
    no_agent: false,
    enabled_toolsets: null,
    model_provider: null,
    model_name: null,
    workdir: null,
    context_from: [],
    deliver: "local",
    timeout_sec: 300,
    builtin: true,
    repeat: null,
    run_count: 0,
    paused: false,
    created_at: new Date("2026-06-07T06:00:00Z"),
    updated_at: new Date("2026-06-07T06:00:00Z"),
    last_run_at: null,
    last_output_ref: null,
  };

  it("mapCronJobRow 完整映射（builtin）", () => {
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

  it("mapCronJobRow 映射 last_output_ref", () => {
    const row = { ...baseCronDbRow, last_output_ref: "cron/output/light-sleep-0003.txt" };
    const result = mapCronJobRow(row);
    expect(result.last_output_ref).toBe("cron/output/light-sleep-0003.txt");
  });

  it("mapCronJobRow 映射 last_run_at 时间戳", () => {
    const row = { ...baseCronDbRow, last_run_at: new Date("2026-06-06T18:00:01Z") };
    const result = mapCronJobRow(row);
    expect(result.last_run_at).toBe("2026-06-06T18:00:01.000Z");
  });

  it("mapCronJobRow 处理用户任务（非 builtin）", () => {
    const row: CronJobDbRow = {
      ...baseCronDbRow,
      id: "abc123",
      name: "每日备份",
      builtin: false,
      repeat: 100,
      enabled_toolsets: ["fs"],
      model_provider: "openai",
      model_name: "gpt-4o",
      workdir: "/tmp",
    };
    const result = mapCronJobRow(row);
    expect(result.builtin).toBe(false);
    expect(result.repeat).toBe(100);
    expect(result.enabled_toolsets).toEqual(["fs"]);
    expect(result.model_provider).toBe("openai");
    expect(result.model_name).toBe("gpt-4o");
    expect(result.workdir).toBe("/tmp");
  });
});
