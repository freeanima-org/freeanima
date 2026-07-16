import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as llm from "./llm.ts";
import { GOAL_JUDGE_REQUEST_PARAMS, judgeGoal, parseGoalJudgeOutput } from "./goal-judge.ts";
import { PROFILE_GOAL_JUDGE } from "@freeanima/core/provider";

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

  it("parses JSON wrapped in markdown fences", () => {
    const r = parseGoalJudgeOutput('```json\n{"done": true, "reason": "完成"}\n```');
    expect(r).toEqual({ ok: true, done: true, reason: "完成" });
  });

  it("parses JSON wrapped in triple quotes", () => {
    const r = parseGoalJudgeOutput(`'''{"done": false, "reason": "未完成"}'''`);
    expect(r).toEqual({ ok: true, done: false, reason: "未完成" });
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
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("rejects empty goal without calling LLM", async () => {
    const r = await judgeGoal({
      goal: "  ",
      subgoals: [],
      assistantReply: "done",
    });
    expect(r).toEqual({ ok: false, error: "empty goal" });
  });

  it("requests json_object response_format via extra", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({
      content: '{"done": true, "reason": "完成"}',
    } as never);
    restores.push(chatSpy);

    const r = await judgeGoal({
      goal: "finish",
      subgoals: [],
      assistantReply: "done",
    });

    expect(r).toEqual({ ok: true, done: true, reason: "完成" });
    expect(chatSpy).toHaveBeenCalledTimes(1);
    const [, opts] = chatSpy.mock.calls[0]!;
    expect(opts?.profileId).toBe(PROFILE_GOAL_JUDGE);
    expect(opts?.requestParams).toEqual({ ...GOAL_JUDGE_REQUEST_PARAMS });
    expect(GOAL_JUDGE_REQUEST_PARAMS.extra.response_format).toEqual({ type: "json_object" });
    expect(GOAL_JUDGE_REQUEST_PARAMS.extra.thinking).toEqual({ type: "disabled" });
    expect(GOAL_JUDGE_REQUEST_PARAMS.maxOutputTokens).toBe(2048);
  });

  it("hints when content empty but reasoning present", async () => {
    restores.push(
      spyOn(llm, "chat").mockResolvedValue({
        content: "",
        reasoning: "thinking about whether the goal is done…",
      } as never),
    );

    const r = await judgeGoal({
      goal: "finish",
      subgoals: [],
      assistantReply: "done",
    });

    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected failure");
    expect(r.error).toContain("empty content, reasoning present");
    expect(r.error).toContain("maxOutputTokens");
  });
});
