import { describe, expect, it } from "vitest";

describe("db jsonb mappers", () => {
  it("platformInfo 合并 platform 与 platform_extra", async () => {
    const { buildPlatformInfo, splitPlatformInfo } = await import(
      "../../dist/schema/jsonb/platform-info.js"
    );
    const info = buildPlatformInfo("discord", {
      channel_id: "c1",
      guild_id: "123",
    });
    expect(info?.platform).toBe("discord");
    if (info?.platform === "discord") {
      expect(info.channel_id).toBe("c1");
      expect(info.guild_id).toBe("123");
    }
    const split = splitPlatformInfo(info);
    expect(split.platform).toBe("discord");
    expect(split.platform_extra).toEqual({ channel_id: "c1", guild_id: "123" });
  });

  it("parlor platformInfo 无 extra", async () => {
    const { buildPlatformInfo, splitPlatformInfo } = await import(
      "../../dist/schema/jsonb/platform-info.js"
    );
    const info = buildPlatformInfo("parlor");
    expect(info).toEqual({ platform: "parlor" });
    expect(splitPlatformInfo(info)).toEqual({ platform: "parlor" });
  });

  it("未知 platform 返回 null", async () => {
    const { buildPlatformInfo } = await import(
      "../../dist/schema/jsonb/platform-info.js"
    );
    expect(buildPlatformInfo("test")).toBeNull();
  });

  it("cron platformInfo", async () => {
    const { buildPlatformInfo, splitPlatformInfo } = await import(
      "../../dist/schema/jsonb/platform-info.js"
    );
    const info = buildPlatformInfo("cron");
    expect(info).toEqual({ platform: "cron" });
    expect(splitPlatformInfo(info)).toEqual({ platform: "cron" });
  });

  it("sessionMetaToInsert 规范化 timestamp", async () => {
    const { sessionMetaToInsert } = await import(
      "../../dist/mappers/session-mapper.js"
    );
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

  it("cron ended_at 规范化进 platform_info", async () => {
    const { sessionMetaToInsert } = await import(
      "../../dist/mappers/session-mapper.js"
    );
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

  it("discord/weixin 缺必填 extra 时用 nothing 占位", async () => {
    const { buildPlatformInfo } = await import(
      "../../dist/schema/jsonb/platform-info.js"
    );
    expect(buildPlatformInfo("discord", {})).toEqual({
      platform: "discord",
      channel_id: "nothing",
    });
    expect(buildPlatformInfo("weixin", {})).toEqual({
      platform: "weixin",
      weixin_user_id: "nothing",
      weixin_peer_id: "nothing",
      is_group: false,
    });
  });

  it("rolePayload 往返 user / tool", async () => {
    const { messageToInsert, rowToMessage } = await import(
      "../../dist/mappers/message-mapper.js"
    );
    const userInsert = messageToInsert("sess", {
      role: "user",
      content: "hi",
      id: 1,
      timestamp: "2026-01-01T00:00:00.000Z",
    });
    expect(userInsert.pos).toBe(1);
    expect(userInsert.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(userInsert.rolePayload).toEqual({ role: "user" });
    const user = rowToMessage(userInsert);
    expect(user.id).toBe(1);

    const toolInsert = messageToInsert("sess", {
      role: "tool",
      tool_call_id: "call_1",
      content: '{"ok":true}',
      id: 2,
      timestamp: "2026-01-01T00:00:01.000Z",
    });
    expect(toolInsert.pos).toBe(2);
    expect(toolInsert.rolePayload.role).toBe("tool");
    const tool = rowToMessage(toolInsert);
    expect(tool.id).toBe(2);
  });
});
