import { afterEach, describe, expect, it } from "bun:test";

import { FALLBACK_TOKENIZER_REPO } from "@freeanima/core/tokenizer/constants";
import {
  ensureFallbackTokenizer,
  resetTokenizerForTest,
  setTokenizerEncodeForTest,
} from "@freeanima/core/tokenizer";

import {
  estimateMessagesTokens,
  estimateTokens,
  estimateToolsTokens,
  messageTextForEstimate,
} from "./token-estimate.ts";

describe("messageTextForEstimate", () => {
  it("joins content, tool_calls, reasoning and name", () => {
    const text = messageTextForEstimate({
      content: "hello",
      tool_calls: [{ id: "1" }],
      reasoning: "think",
      name: "fn",
    });
    expect(text).toContain("hello");
    expect(text).toContain('[{"id":"1"}]');
    expect(text).toContain("think");
    expect(text).toContain("fn");
  });
});

describe("token estimate helpers", () => {
  afterEach(() => {
    resetTokenizerForTest();
  });

  async function wireOneTokenPerChar(): Promise<void> {
    setTokenizerEncodeForTest(FALLBACK_TOKENIZER_REPO, (text) => {
      const n = text.trim().length;
      return n ? Array.from({ length: n }, (_, i) => i + 1) : [];
    });
    await ensureFallbackTokenizer();
  }

  it("estimateTokens uses tokenizer", async () => {
    await wireOneTokenPerChar();
    expect(estimateTokens("abcd")).toBe(4);
  });

  it("estimateMessagesTokens sums message parts", async () => {
    await wireOneTokenPerChar();
    const total = estimateMessagesTokens([{ content: "ab" }, { content: "c" }]);
    expect(total).toBe(3);
  });

  it("estimateToolsTokens returns 0 for empty tools", async () => {
    await wireOneTokenPerChar();
    expect(estimateToolsTokens(undefined)).toBe(0);
    expect(estimateToolsTokens([])).toBe(0);
  });

  it("estimateToolsTokens counts serialized tools", async () => {
    await wireOneTokenPerChar();
    const tools = [{ type: "function", function: { name: "x" } }];
    const json = JSON.stringify(tools);
    expect(estimateToolsTokens(tools)).toBe(json.length);
  });
});
