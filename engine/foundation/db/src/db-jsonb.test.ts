import { describe, expect, it } from "bun:test";
import { buildPlatformInfo, splitPlatformInfo } from "./schema/jsonb/platform-info.ts";
import {
  normalizeSessionToolNames,
  sessionToolsSchema,
} from "./schema/jsonb/session-meta-jsonb.ts";

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

  it("parlor platformInfo has no extra", () => {
    const info = buildPlatformInfo("parlor");
    expect(info).toEqual({ platform: "parlor" });
    expect(splitPlatformInfo(info)).toEqual({ platform: "parlor" });
  });

  it("unknown platform returns null", () => {
    expect(buildPlatformInfo("test")).toBeNull();
  });

  it("cron platformInfo", () => {
    const info = buildPlatformInfo("cron");
    expect(info).toEqual({ platform: "cron" });
    expect(splitPlatformInfo(info)).toEqual({ platform: "cron" });
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

describe("session tools jsonb", () => {
  it("normalizeSessionToolNames keeps tool name strings", () => {
    expect(normalizeSessionToolNames(["file_read_file", "grep"])).toEqual([
      "file_read_file",
      "grep",
    ]);
  });

  it("normalizeSessionToolNames extracts function.name from legacy OpenAI schema", () => {
    const legacy = [
      { type: "function", function: { name: "file_read_file", description: "read" } },
      { type: "function", function: { name: "grep" } },
    ];
    expect(normalizeSessionToolNames(legacy)).toEqual(["file_read_file", "grep"]);
    expect(sessionToolsSchema.parse(legacy)).toEqual(["file_read_file", "grep"]);
  });

  it("normalizeSessionToolNames ignores invalid entries", () => {
    expect(normalizeSessionToolNames([null, "", {}, { function: {} }])).toEqual([]);
  });
});
