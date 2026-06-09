import { describe, it, expect } from "bun:test";
import { injectTimePrefixes } from "./time-perception.ts";
import type { SessionMessage, UserMessage } from "@freeanima/engine-db/domain";

/** 生成 ISO+08 时间戳字符串 */
function ts(isoLocal: string): string {
  return `${isoLocal}.000+08:00`;
}

function prefixed(content: string, isoLocal: string): string {
  return `time: ${isoLocal}\n${content}`;
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
  it("单条 user 消息加 time 前缀（独占一行）", () => {
    const msgs = [userMsg("早", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("早", "2026-05-20T08:02"),
    );
  });

  it("多条 user 消息每条都加（含同一天连续短间隔）", () => {
    const msgs = [
      userMsg("早", ts("2026-05-20T08:02:00")),
      assistantMsg("早☀️"),
      userMsg("对了", ts("2026-05-20T08:05:00")),
      userMsg("吃饭了", ts("2026-05-20T12:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("早", "2026-05-20T08:02"),
    );
    expect(result[2]!.role === "user" && result[2].content).toBe(
      prefixed("对了", "2026-05-20T08:05"),
    );
    expect(result[3]!.role === "user" && result[3].content).toBe(
      prefixed("吃饭了", "2026-05-20T12:15"),
    );
  });

  it("跨天消息每条都带完整日期时间", () => {
    const msgs = [
      userMsg("晚安", ts("2026-05-20T22:30:00")),
      assistantMsg("晚安🌙"),
      userMsg("早", ts("2026-05-21T09:15:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("晚安", "2026-05-20T22:30"),
    );
    expect(result[2]!.role === "user" && result[2].content).toBe(
      prefixed("早", "2026-05-21T09:15"),
    );
  });

  it("无 timestamp 的 user 消息跳过", () => {
    const msgs: SessionMessage[] = [
      { role: "user", content: "无时间" },
      userMsg("有时间", ts("2026-05-20T10:00:00")),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("无时间");
    expect(result[1]!.role === "user" && result[1].content).toBe(
      prefixed("有时间", "2026-05-20T10:00"),
    );
  });

  it("timestamp 格式异常时跳过", () => {
    const msgs = [userMsg("坏时间", "not-a-date")];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "user" && result[0].content).toBe("坏时间");
  });

  it("assistant / tool 消息不加前缀", () => {
    const msgs = [
      systemMsg("你是数字生命"),
      userMsg("你好", ts("2026-05-20T10:00:00")),
      assistantMsg("你好👋"),
      toolMsg("web_search", '{"q":"test"}'),
    ];
    const result = injectTimePrefixes(msgs);
    expect(result[0]!.role === "system" && result[0].content).toBe("你是数字生命");
    expect(result[1]!.role === "user" && result[1].content).toBe(
      prefixed("你好", "2026-05-20T10:00"),
    );
    expect(result[2]!.role === "assistant" && result[2].content).toBe("你好👋");
    expect(result[3]!.role).toBe("tool");
  });

  it("不会修改原始消息对象", () => {
    const original: SessionMessage[] = [userMsg("早", ts("2026-05-20T08:02:00"))];
    const result = injectTimePrefixes(original);
    expect(result[0]!.role === "user" && result[0].content).toBe(
      prefixed("早", "2026-05-20T08:02"),
    );
    expect(original[0]!.role === "user" && original[0].content).toBe("早");
    expect(result[0]).not.toBe(original[0]);
  });

  it("空消息列表返回空", () => {
    const result = injectTimePrefixes([]);
    expect(result).toEqual([]);
  });
});
