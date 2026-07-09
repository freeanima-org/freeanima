import { describe, expect, it, mock } from "bun:test";

mock.module("@paraglide/messages", () => ({ m: {} }));
mock.module("@paraglide/runtime", () => ({
  getLocale: () => "zh-cn",
  locales: ["zh-cn", "en"],
  setLocale: async (_locale: string) => {},
}));

import { stripLeadingNavEmoji } from "./shell-nav-i18n.ts";

describe("stripLeadingNavEmoji", () => {
  it("去掉前缀 emoji 与空格", () => {
    expect(stripLeadingNavEmoji("✅ 任务")).toBe("任务");
    expect(stripLeadingNavEmoji("📧 邮件")).toBe("邮件");
    expect(stripLeadingNavEmoji("🌙 梦境")).toBe("梦境");
    expect(stripLeadingNavEmoji("📊 仪表盘")).toBe("仪表盘");
  });

  it("无 emoji 时保持原样", () => {
    expect(stripLeadingNavEmoji("聊天室")).toBe("聊天室");
    expect(stripLeadingNavEmoji("通知")).toBe("通知");
  });
});
