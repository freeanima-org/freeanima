import { describe, it, expect, spyOn, afterEach, beforeEach, mock } from "bun:test";
import * as llm from "./llm.ts";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/world-context";
import {
  fallbackConversationTitle,
  generateConversationTitle,
  sanitizeConversationTitle,
  SESSION_TITLE_MAX_OUTPUT_TOKENS,
  SESSION_TITLE_REQUEST_PARAMS,
} from "./conversation-title.ts";
import { PROFILE_SUMMARY } from "@freeanima/habitat/core/provider";

mock.module("@freeanima/habitat/core/db/pg", () => ({
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/habitat/core/db/pg/auto-llm-run", () => ({
  appendAutoLlmRun: mock(async () => {}),
  purgeStaleAutoLlmRuns: mock(async () => ({ deleted: 0 })),
  listAutoLlmRuns: mock(async () => []),
  countAutoLlmRuns: mock(async () => 0),
  getAutoLlmRun: mock(async () => null),
  listAutoLlmMessages: mock(async () => []),
}));

describe("sanitizeConversationTitle", () => {
  it("trims quotes and collapses whitespace", () => {
    expect(sanitizeConversationTitle('"Hello world"\n')).toBe("Hello world");
    expect(sanitizeConversationTitle("  foo   bar  ")).toBe("foo bar");
  });

  it("caps at 50 characters", () => {
    const long = "a".repeat(80);
    expect(sanitizeConversationTitle(long).length).toBe(50);
  });
});

describe("fallbackConversationTitle", () => {
  it("uses first 30 characters", () => {
    expect(fallbackConversationTitle("hello")).toBe("hello");
    expect(fallbackConversationTitle("x".repeat(40)).length).toBe(30);
  });

  it("strips stage-direction parentheses", () => {
    expect(fallbackConversationTitle("（轻轻点头）马上了，这就到小区门口")).toBe(
      "马上了，这就到小区门口",
    );
  });
});

describe("generateConversationTitle", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      commons_world_id: 30,
    });
  });

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    resetResolvedWorldContextForTest();
  });

  it("calls chat with summary profile and dedicated system prompt", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "Fix login bug" });
    restores.push(chatSpy);

    const result = await generateConversationTitle("The login page throws 500");

    expect(result).toEqual({ ok: true, title: "Fix login bug", had_reasoning: false });
    expect(chatSpy).toHaveBeenCalledTimes(1);
    const [messages, opts] = chatSpy.mock.calls[0]!;
    expect(messages[0]).toMatchObject({ role: "system" });
    expect(String(messages[0]?.content)).toContain("auto_llm_protocol");
    expect(String(messages[0]?.content)).toContain("conversation-title");
    expect(String(messages[0]?.content)).toContain("不是对用户的回复");
    expect(messages[1]?.role).toBe("user");
    expect(String(messages[1]?.content)).toContain("The login page throws 500");
    expect(opts?.profileId).toBe(PROFILE_SUMMARY);
    expect(opts?.requestParams).toEqual(SESSION_TITLE_REQUEST_PARAMS);
    expect(SESSION_TITLE_REQUEST_PARAMS.extra.thinking).toEqual({ type: "disabled" });
    expect(SESSION_TITLE_REQUEST_PARAMS.extra.tool_choice).toBe("none");
    expect(SESSION_TITLE_MAX_OUTPUT_TOKENS).toBe(30);
  });

  it("does not use reasoning when content is empty", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({
      content: "",
      reasoning: "小区门口碰面",
      model: "deepseek-reasoner",
      finish_reason: "stop",
    });
    restores.push(chatSpy);

    const result = await generateConversationTitle("（轻轻点了下头）");
    expect(result).toEqual({
      ok: false,
      error: "LLM returned empty title",
      model: "deepseek-reasoner",
      finish_reason: "stop",
      had_reasoning: true,
    });
  });

  it("returns diagnostics when LLM returns empty", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({
      content: "   ",
      reasoning: "",
      model: "test-model",
      finish_reason: "length",
    });
    restores.push(chatSpy);

    const result = await generateConversationTitle("hello");
    expect(result).toEqual({
      ok: false,
      error: "LLM returned empty title",
      model: "test-model",
      finish_reason: "length",
      had_reasoning: false,
    });
  });

  it("returns error for empty user text without calling chat", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "x" });
    restores.push(chatSpy);

    const result = await generateConversationTitle("   ");
    expect(result).toEqual({ ok: false, error: "empty user text" });
    expect(chatSpy).not.toHaveBeenCalled();
  });
});
