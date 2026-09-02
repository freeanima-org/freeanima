import { describe, expect, it } from "bun:test";

import { parseVoiceIntent } from "./intent-parser.ts";

describe("parseVoiceIntent", () => {
  const now = new Date("2026-09-02T10:00:00.000Z");

  it("识别番茄指令", () => {
    expect(parseVoiceIntent("开始番茄", now)).toEqual({ kind: "pomodoro" });
    expect(parseVoiceIntent("小风，启动专注", now)).toEqual({ kind: "pomodoro" });
  });

  it("识别添加任务", () => {
    expect(parseVoiceIntent("添加任务买牛奶", now)).toEqual({
      kind: "task",
      title: "买牛奶",
    });
  });

  it("识别写日记", () => {
    expect(parseVoiceIntent("写日记：今天完成了语音助手", now)).toEqual({
      kind: "diary",
      content: "今天完成了语音助手",
    });
  });

  it("识别带时间的提醒", () => {
    const intent = parseVoiceIntent("明天早上七点提醒我开会", now);
    expect(intent.kind).toBe("reminder");
    if (intent.kind !== "reminder") return;
    expect(intent.title).toBe("开会");
    expect(intent.remind_at).toMatch(/^2026-09-03T/);
  });

  it("无法识别时返回 unknown", () => {
    expect(parseVoiceIntent("随便说点什么", now)).toEqual({
      kind: "unknown",
      raw: "随便说点什么",
    });
  });
});
