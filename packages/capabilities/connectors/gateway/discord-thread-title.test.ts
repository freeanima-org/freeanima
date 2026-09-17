import { describe, expect, it } from "bun:test";
import {
  discordThreadNameFromUserMessage,
  discordThreadTitleFromSession,
  shouldRenameDiscordThread,
} from "./discord/discord-thread-title.ts";

describe("discord thread title", () => {
  it("truncates conversation title to Discord limit", () => {
    expect(discordThreadTitleFromSession("  hello  ")).toBe("hello");
    expect(discordThreadTitleFromSession("x".repeat(120)).length).toBe(100);
  });

  it("discordThreadNameFromUserMessage uses first 10 chars", () => {
    expect(discordThreadNameFromUserMessage("  hello world  ")).toBe("hello worl");
    expect(discordThreadNameFromUserMessage("你好世界测试消息")).toBe(
      "你好世界测试消息".slice(0, 10),
    );
    expect(discordThreadNameFromUserMessage("   ")).toBe("…");
  });

  it("shouldRenameDiscordThread skips when names match", () => {
    expect(shouldRenameDiscordThread("Fix login", "Fix login")).toBe(false);
    expect(shouldRenameDiscordThread("  Fix login  ", "Fix login")).toBe(false);
  });

  it("shouldRenameDiscordThread returns true when different", () => {
    expect(shouldRenameDiscordThread("Free Anima × Bob", "Fix login")).toBe(true);
  });

  it("shouldRenameDiscordThread returns false for empty title", () => {
    expect(shouldRenameDiscordThread("old", "   ")).toBe(false);
  });
});
