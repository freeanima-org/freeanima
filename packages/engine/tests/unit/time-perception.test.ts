import { describe, it, expect } from "vitest";
import { injectTimePrefixes } from "../../src/time-perception.js";
import type { SessionMessage, UserMessage } from "../../src/schemas/message.js";

/** 生成 ISO+08 时间戳字符串 */
function ts(isoLocal: string): string {
  return `${isoLocal}.000+08:00`;
}

function userMsg(content: string, timestamp: string): UserMessage {
  return { role: "user", content, timestamp };
}

function assistantMsg(content: string): SessionMessage {
  return { role: "assistant", content };
}

function toolMsg(name: string, content: string): SessionMessage {
  return { role: "tool", tool_call_id: "tc1", name, content };
}

function systemMsg(content: string): SessionMessage {
  return { role: "system", content };
}

describe("injectTimePrefixes", () => {
  it("第一条 user 消息带完整日期", () => {
    const msgs = [userMsg("早", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("[2026-05-20 周三 08:02] 早");
  });

  it("同一天 ≥ minGap 带 HH:MM", () => {
    const msgs = [
      userMsg("早", ts("2026-05-20T08:02:00")),
      assistantMsg("早☀️"),
      userMsg("吃饭了", ts("2026-05-20T12:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("[2026-05-20 周三 08:02] 早");
    expect(result[2]!.role === "user" && result[2].content).toBe("[12:15] 吃饭了");
  });

  it("同一天 < minGap 不加前缀", () => {
    const msgs = [
      userMsg("早", ts("2026-05-20T08:02:00")),
      assistantMsg("早☀️"),
      userMsg("对了", ts("2026-05-20T08:05:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("[2026-05-20 周三 08:02] 早");
    expect(result[2]!.role === "user" && result[2].content).toBe("对了");
  });

  it("跨天带完整日期", () => {
    const msgs = [
      userMsg("晚安", ts("2026-05-20T22:30:00")),
      assistantMsg("晚安🌙"),
      userMsg("早", ts("2026-05-21T09:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("[2026-05-20 周三 22:30] 晚安");
    expect(result[2]!.role === "user" && result[2].content).toBe("[2026-05-21 周四 09:15] 早");
  });

  it("多条跨天消息均带完整日期", () => {
    const msgs = [
      userMsg("周一", ts("2026-05-18T10:00:00")),
      assistantMsg("ok"),
      userMsg("周三", ts("2026-05-20T10:00:00")),
      assistantMsg("ok"),
      userMsg("周四", ts("2026-05-21T10:00:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toContain("2026-05-18");
    expect(result[2]!.role === "user" && result[2].content).toContain("2026-05-20");
    expect(result[4]!.role === "user" && result[4].content).toContain("2026-05-21");
  });

  it("无 timestamp 的 user 消息跳过", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "无时间" },
      userMsg("有时间", ts("2026-05-20T10:00:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("无时间");
    expect(result[1]!.role === "user" && result[1].content).toBe("[2026-05-20 周三 10:00] 有时间");
  });

  it("非 user 消息不受影响", () => {
    const msgs = [
      systemMsg("你是数字生命"),
      userMsg("你好", ts("2026-05-20T10:00:00")),
      assistantMsg("你好👋"),
      toolMsg("web_search", '{"q":"test"}'),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "system" && result[0].content).toBe("你是数字生命");
    expect(result[1]!.role === "user" && result[1].content).toBe("[2026-05-20 周三 10:00] 你好");
    expect(result[2]!.role === "assistant" && result[2].content).toBe("你好👋");
    expect(result[3]!.role).toBe("tool");
  });

  it("enabled=false 不注入", () => {
    const msgs = [userMsg("早", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(msgs, { enabled: false });
    expect(result[0]!.role === "user" && result[0].content).toBe("早");
  });

  it("精确 10 分钟边界 >= 10 注入", () => {
    const msgs = [
      userMsg("早", ts("2026-05-20T08:00:00")),
      userMsg("刚好10分", ts("2026-05-20T08:10:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("[2026-05-20 周三 08:00] 早");
    expect(result[1]!.role === "user" && result[1].content).toBe("[08:10] 刚好10分");
  });

  it("自定义 minGapMinutes", () => {
    const msgs = [
      userMsg("早", ts("2026-05-20T08:00:00")),
      userMsg("5分钟", ts("2026-05-20T08:05:00")),
    ];
    const result = injectTimePrefixes(msgs, { minGapMinutes: 30 });
    expect(result[0]!.role === "user" && result[0].content).toContain("2026-05-20");
    expect(result[1]!.role === "user" && result[1].content).toBe("5分钟");

    const result2 = injectTimePrefixes(msgs, { minGapMinutes: 3 });
    expect(result2[1]!.role === "user" && result2[1].content).toBe("[08:05] 5分钟");
  });

  it("不会修改原始消息对象", () => {
    const original: SessionMessage[] = [userMsg("早", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(original);
    expect(result[0]!.role === "user" && result[0].content).toBe("[2026-05-20 周三 08:02] 早");
    expect(original[0]!.role === "user" && original[0].content).toBe("早");
    expect(result[0]).not.toBe(original[0]);
  });

  it("空消息列表返回空", () => {
    const result = injectTimePrefixes([]);
    expect(result).toEqual([]);
  });
});
