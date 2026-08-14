import { describe, it, expect } from "bun:test";
import {
  extractOrigin,
  mergeDiscordConfig,
  shouldCreateThread,
  shouldRespond,
  stripBotMention,
} from "@freeanima/habitat/capabilities/connectors/gateway";

describe("discord-policy", () => {
  const base = {
    content: "hello",
    authorIsBot: false,
    isDm: false,
    isThread: false,
    channelId: "100",
    parentChannelId: "100",
    isMentioned: false,
    isReplyToBot: false,
  };

  it("requires mention in guild channel by default", () => {
    const cfg = mergeDiscordConfig({});
    expect(shouldRespond({ ...base, isMentioned: false }, cfg)).toBe(false);
    expect(shouldRespond({ ...base, isMentioned: true }, cfg)).toBe(true);
  });

  it("responds in thread without mention when thread_require_mention is false", () => {
    const cfg = mergeDiscordConfig({ thread_require_mention: false });
    expect(
      shouldRespond({ ...base, isThread: true, channelId: "200", parentChannelId: "100" }, cfg),
    ).toBe(true);
  });

  it("free_response_channels bypass mention", () => {
    const cfg = mergeDiscordConfig({ free_response_channels: "100" });
    expect(shouldRespond({ ...base, channelId: "100" }, cfg)).toBe(true);
  });

  it("extractOrigin for thread uses parent channel_id", () => {
    const o = extractOrigin({
      channelId: "thread-1",
      parentChannelId: "chan-1",
      guildId: "guild-1",
      isThread: true,
    });
    expect(o.platform).toBe("discord");
    expect(o.platform_extra.channel_id).toBe("chan-1");
    expect(o.platform_extra.thread_id).toBe("thread-1");
    expect(o.platform_extra.guild_id).toBe("guild-1");
  });

  it("shouldCreateThread false in free response channel", () => {
    const cfg = mergeDiscordConfig({ free_response_channels: "100" });
    expect(shouldCreateThread({ ...base, channelId: "100" }, cfg)).toBe(false);
  });

  it("stripBotMention removes mention tokens", () => {
    expect(stripBotMention("<@123> hi", "123")).toBe("hi");
    expect(stripBotMention("<@!123> hi", "123")).toBe("hi");
  });
});
