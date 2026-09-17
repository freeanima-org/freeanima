import { describe, expect, it } from "bun:test";

import {
  filterMessagesAfterAt,
  formatMessagesForSummary,
  temporalMaterialAfterAt,
  cstDayStartIso,
} from "./index.ts";

describe("temporal-summary tick material bounds", () => {
  it("excludes messages at or before afterAt", () => {
    const msgs = [
      { t: "2026-06-30T12:00:00+08:00", role: "user" as const, content: "old" },
      { t: "2026-07-31T10:00:00+08:00", role: "user" as const, content: "today" },
      { t: "2026-07-31T11:00:00+08:00", role: "assistant" as const, content: "reply" },
    ];
    const after = temporalMaterialAfterAt(undefined, "2026-07-31T00:00:00+08:00");
    const filtered = filterMessagesAfterAt(msgs, after);
    expect(filtered.map((m) => m.content)).toEqual(["today", "reply"]);
    const text = formatMessagesForSummary(msgs, after);
    expect(text).toContain("today");
    expect(text).not.toContain("old");
  });

  it("cross-day watermark reset still floors at CST day start", () => {
    const dayStart = cstDayStartIso(Date.parse("2026-07-31T10:00:00+08:00"));
    // 模拟跨日清空 watermark 后误用旧消息时间：下界仍应是日始
    expect(temporalMaterialAfterAt(undefined, dayStart)).toBe(dayStart);
    const msgs = [
      { t: "2026-06-30T18:00:00+08:00", role: "user" as const, content: "june" },
      { t: "2026-07-31T09:00:00+08:00", role: "user" as const, content: "july" },
    ];
    expect(formatMessagesForSummary(msgs, dayStart)).toContain("july");
    expect(formatMessagesForSummary(msgs, dayStart)).not.toContain("june");
  });

  it("respects watermark when it is already today", () => {
    const dayStart = "2026-07-31T00:00:00+08:00";
    const wm = "2026-07-31T09:30:00+08:00";
    const after = temporalMaterialAfterAt(wm, dayStart);
    const msgs = [
      { t: "2026-07-31T09:00:00+08:00", role: "user" as const, content: "before" },
      { t: "2026-07-31T10:00:00+08:00", role: "user" as const, content: "after" },
    ];
    expect(formatMessagesForSummary(msgs, after)).toBe(
      '<message role="user" t="2026-07-31T10:00:00">after</message>',
    );
  });
});
