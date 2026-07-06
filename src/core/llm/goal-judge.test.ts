import { describe, it, expect } from "bun:test";
import { judgeGoal, parseGoalJudgeOutput } from "./goal-judge.ts";

describe("parseGoalJudgeOutput", () => {
  it("parses plain JSON", () => {
    const r = parseGoalJudgeOutput('{"done": true, "reason": "已发布 2 件作品"}');
    expect(r).toEqual({ ok: true, done: true, reason: "已发布 2 件作品" });
  });

  it("parses JSON embedded in text", () => {
    const r = parseGoalJudgeOutput(
      'Here is the result:\n{"done": false, "reason": "仍在收集素材"}\n',
    );
    expect(r).toEqual({ ok: true, done: false, reason: "仍在收集素材" });
  });

  it("rejects missing done", () => {
    const r = parseGoalJudgeOutput('{"reason": "x"}');
    expect(r.ok).toBe(false);
  });

  it("rejects non-JSON", () => {
    const r = parseGoalJudgeOutput("not json");
    expect(r.ok).toBe(false);
  });

  it("rejects missing reason", () => {
    const r = parseGoalJudgeOutput('{"done": true, "reason": "  "}');
    expect(r).toEqual({ ok: false, error: "judge JSON missing reason" });
  });

  it("reports JSON parse errors", () => {
    const r = parseGoalJudgeOutput("{done: true}");
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected failure");
    expect(r.error).toContain("judge JSON parse error");
  });
});

describe("judgeGoal", () => {
  it("rejects empty goal without calling LLM", async () => {
    const r = await judgeGoal({
      goal: "  ",
      subgoals: [],
      assistantReply: "done",
    });
    expect(r).toEqual({ ok: false, error: "empty goal" });
  });
});
