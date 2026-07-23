import { describe, expect, it } from "bun:test";
import { buildPlatformInfo, splitPlatformInfo } from "./schema/jsonb/platform-info.ts";
import {
  acpTasksSchema,
  acpTaskEntrySchema,
  conversationCachedToolsetsSchema,
} from "./schema/jsonb/conversation-meta-jsonb.ts";

describe("platform_info schema", () => {
  it("platformInfo merges platform and platform_extra", () => {
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

  it("sap platformInfo derives satellite fields from three segments", () => {
    const info = buildPlatformInfo("remote:chat:k7m");
    expect(info).toEqual({
      platform: "remote:chat:k7m",
      outpost_app_id: "chat",
      outpost_instance_id: "k7m",
    });
    expect(splitPlatformInfo(info)).toEqual({
      platform: "remote:chat:k7m",
      platform_extra: { outpost_app_id: "chat", outpost_instance_id: "k7m" },
    });
  });

  it("unknown platform returns null", () => {
    expect(buildPlatformInfo("test")).toBeNull();
  });

  it("cron platformInfo", () => {
    const info = buildPlatformInfo("cron");
    expect(info).toEqual({ platform: "cron" });
    expect(splitPlatformInfo(info)).toEqual({ platform: "cron" });
  });

  it("sap platformInfo preserves capability_mask in platform_info", () => {
    const info = buildPlatformInfo("remote:chat:k7m", {
      capability_mask: { presets: ["sleep"] },
    });
    expect(info?.platform).toBe("remote:chat:k7m");
    expect(splitPlatformInfo(info).platform_extra?.capability_mask).toEqual({
      presets: ["sleep"],
    });
  });

  it("discord platformInfo preserves gateway_tool_display in platform_info", () => {
    const info = buildPlatformInfo("discord", {
      channel_id: "c1",
      gateway_tool_display: "hidden",
    });
    expect(info?.platform).toBe("discord");
    expect(splitPlatformInfo(info).platform_extra?.gateway_tool_display).toBe("hidden");
  });

  it("discord/weixin uses nothing placeholder when required extra missing", () => {
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
});

describe("conversation tools jsonb", () => {
  it("conversationCachedToolsetsSchema accepts tool name strings", () => {
    expect(conversationCachedToolsetsSchema.parse(["file_read", "grep"])).toEqual([
      "file_read",
      "grep",
    ]);
  });
});

describe("acp_tasks jsonb", () => {
  it("acpTasksSchema accepts standard entries keyed by ACP conversation id", () => {
    const entry = {
      status: "running" as const,
      task_id: "task-2",
      agent_name: "cursor",
      updated_at: "2026-06-12T10:00:00.000Z",
    };
    expect(acpTaskEntrySchema.parse(entry)).toEqual(entry);
    expect(acpTasksSchema.parse({ "acp-uuid-2": entry })).toEqual({
      "acp-uuid-2": entry,
    });
  });
});
