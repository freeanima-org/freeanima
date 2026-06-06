import { describe, expect, it } from "bun:test";
import { buildPlatformInfo, splitPlatformInfo } from "../../src/schema/jsonb/platform-info.ts";

describe("platform_info schema", () => {
  it("platformInfo 合并 platform 与 platform_extra", () => {
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

  it("parlor platformInfo 无 extra", () => {
    const info = buildPlatformInfo("parlor");
    expect(info).toEqual({ platform: "parlor" });
    expect(splitPlatformInfo(info)).toEqual({ platform: "parlor" });
  });

  it("未知 platform 返回 null", () => {
    expect(buildPlatformInfo("test")).toBeNull();
  });

  it("cron platformInfo", () => {
    const info = buildPlatformInfo("cron");
    expect(info).toEqual({ platform: "cron" });
    expect(splitPlatformInfo(info)).toEqual({ platform: "cron" });
  });

  it("discord/weixin 缺必填 extra 时用 nothing 占位", () => {
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
