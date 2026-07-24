import { describe, expect, it } from "bun:test";

import { stripTemporalSummaryPreamble, temporalSummaryOutputConstraints } from "./summarize.ts";

describe("stripTemporalSummaryPreamble", () => {
  it("strips 收到 + 我这就… meta sentence", () => {
    const raw =
      "收到，我这就把这一段会话的客观事实整理成一条连贯的摘要。用户登录后处理了环境重启通知。";
    expect(stripTemporalSummaryPreamble(raw)).toBe("用户登录后处理了环境重启通知。");
  });

  it("strips 收到，我就… variant", () => {
    const raw =
      "收到，我就把这一段会话的客观事实整理成一条连贯的摘要。助手检查了 env-health 任务。";
    expect(stripTemporalSummaryPreamble(raw)).toBe("助手检查了 env-health 任务。");
  });

  it("strips 好的 / 明白 openings", () => {
    expect(stripTemporalSummaryPreamble("好的，下面是摘要。事件 A 发生了。")).toBe(
      "事件 A 发生了。",
    );
    expect(stripTemporalSummaryPreamble("明白。今日无新活动。")).toBe("今日无新活动。");
  });

  it("strips meta without leading ack", () => {
    const raw = "我将把这段整理成摘要。双方讨论了部署失败。";
    expect(stripTemporalSummaryPreamble(raw)).toBe("双方讨论了部署失败。");
  });

  it("leaves clean summary unchanged", () => {
    const raw = "用户处理了环境重启通知，并排查了定时任务失败。";
    expect(stripTemporalSummaryPreamble(raw)).toBe(raw);
  });

  it("trims whitespace after strip", () => {
    const raw = "收到，这就整理摘要。\n\n  正文开始。";
    expect(stripTemporalSummaryPreamble(raw)).toBe("正文开始。");
  });
});

describe("temporalSummaryOutputConstraints", () => {
  it("mentions char cap and bans preamble", () => {
    const text = temporalSummaryOutputConstraints(500);
    expect(text).toContain("500");
    expect(text).toContain("收到");
    expect(text).toContain("事件级");
  });
});
