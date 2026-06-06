import { describe, expect, it } from "bun:test";
import { messageToInsert, rowToMessage } from "../../src/session/mappers/message-mapper.ts";
import { sessionMetaToInsert } from "../../src/session/mappers/session-mapper.ts";

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
    const user = rowToMessage(userInsert);
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
    const tool = rowToMessage(toolInsert);
    expect(tool.pos).toBe(2);
  });
});
