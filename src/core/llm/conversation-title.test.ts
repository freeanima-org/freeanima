import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as llm from "./llm.ts";
import {
  fallbackConversationTitle,
  generateConversationTitle,
  sanitizeConversationTitle,
  SESSION_TITLE_MAX_OUTPUT_TOKENS,
} from "./conversation-title.ts";
import { PROFILE_SUMMARY } from "@freeanima/core/provider";

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

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("calls chat with summary profile and dedicated system prompt", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "Fix login bug" } as never);
    restores.push(chatSpy);

    const result = await generateConversationTitle("The login page throws 500");

    expect(result).toEqual({ ok: true, title: "Fix login bug", had_reasoning: false });
    expect(chatSpy).toHaveBeenCalledTimes(1);
    const [messages, opts] = chatSpy.mock.calls[0]!;
    expect(messages[0]).toMatchObject({ role: "system" });
    expect(String(messages[0]?.content)).toContain("NOT a reply");
    expect(String(messages[0]?.content)).toContain("sidebar");
    expect(messages[1]).toEqual({ role: "user", content: "The login page throws 500" });
    expect(opts?.profileId).toBe(PROFILE_SUMMARY);
    expect(opts?.requestParams).toEqual({ maxOutputTokens: SESSION_TITLE_MAX_OUTPUT_TOKENS });
    expect(SESSION_TITLE_MAX_OUTPUT_TOKENS).toBe(30);
  });

  it("does not use reasoning when content is empty", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({
      content: "",
      reasoning: "小区门口碰面",
      model: "deepseek-reasoner",
      finish_reason: "stop",
    } as never);
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
    } as never);
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
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "x" } as never);
    restores.push(chatSpy);

    const result = await generateConversationTitle("   ");
    expect(result).toEqual({ ok: false, error: "empty user text" });
    expect(chatSpy).not.toHaveBeenCalled();
  });
});
