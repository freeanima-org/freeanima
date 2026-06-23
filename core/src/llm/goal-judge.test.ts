import { describe, it, expect } from "bun:test";
import { parseGoalJudgeOutput } from "./goal-judge.ts";

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
});
