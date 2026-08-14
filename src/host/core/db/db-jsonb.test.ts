import { describe, expect, it } from "bun:test";
import { buildPlatformInfo, splitPlatformInfo } from "./schema/jsonb/platform-info.ts";
import {
  acpTasksSchema,
  acpTaskEntrySchema,
  conversationCachedToolsetsSchema,
  normalizeAcpTasks,
  normalizeConversationToolNames,
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

  it("sap platformInfo preserves arbitrary extras in platform_info", () => {
    const info = buildPlatformInfo("remote:chat:k7m", {
      note: "hello",
    });
    expect(info?.platform).toBe("remote:chat:k7m");
    expect(splitPlatformInfo(info).platform_extra?.note).toBe("hello");
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
  it("normalizeConversationToolNames keeps tool name strings", () => {
    expect(normalizeConversationToolNames(["file_read", "grep"])).toEqual(["file_read", "grep"]);
  });

  it("normalizeConversationToolNames extracts function.name from legacy OpenAI schema", () => {
    const legacy = [
      { type: "function", function: { name: "file_read", description: "read" } },
      { type: "function", function: { name: "grep" } },
    ];
    expect(normalizeConversationToolNames(legacy)).toEqual(["file_read", "grep"]);
    expect(conversationCachedToolsetsSchema.parse(legacy)).toEqual(["file_read", "grep"]);
  });

  it("normalizeConversationToolNames ignores invalid entries", () => {
    expect(normalizeConversationToolNames([null, "", {}, { function: {} }])).toEqual([]);
  });

  it("conversationCachedToolsetsSchema accepts tool name strings", () => {
    expect(conversationCachedToolsetsSchema.parse(["file_read", "grep"])).toEqual([
      "file_read",
      "grep",
    ]);
  });
});

describe("acp_tasks jsonb", () => {
  it("normalizeAcpTasks converts legacy agent-keyed string bindings", () => {
    expect(normalizeAcpTasks({ cursor: "acp-uuid-1" })).toEqual({
      "acp-uuid-1": {
        status: "completed",
        task_id: "legacy",
        agent_name: "cursor",
        updated_at: "1970-01-01T00:00:00.000Z",
      },
    });
    expect(acpTasksSchema.parse({ cursor: "acp-uuid-1" })).toEqual({
      "acp-uuid-1": {
        status: "completed",
        task_id: "legacy",
        agent_name: "cursor",
        updated_at: "1970-01-01T00:00:00.000Z",
      },
    });
  });

  it("normalizeAcpTasks keeps new-format entries and mixed legacy", () => {
    const mixed = {
      cursor: "legacy-session-id",
      "acp-uuid-2": {
        status: "running",
        task_id: "task-2",
        agent_name: "cursor",
        updated_at: "2026-06-12T10:00:00.000Z",
      },
    };
    expect(acpTasksSchema.parse(mixed)).toEqual({
      "legacy-session-id": {
        status: "completed",
        task_id: "legacy",
        agent_name: "cursor",
        updated_at: "1970-01-01T00:00:00.000Z",
      },
      "acp-uuid-2": {
        status: "running",
        task_id: "task-2",
        agent_name: "cursor",
        updated_at: "2026-06-12T10:00:00.000Z",
      },
    });
  });

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
