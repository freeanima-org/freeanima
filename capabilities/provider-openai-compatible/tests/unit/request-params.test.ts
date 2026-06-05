import { describe, expect, it } from "bun:test";
import type { ChatRequest } from "@freeanima/engine-provider-llm";
import {
  buildChatCompletionParams,
  buildStreamingChatCompletionParams,
} from "../../src/request-params.ts";

const baseRequest: ChatRequest = {
  messages: [{ role: "user", content: "ping" }],
  systemPrompt: "sys",
  params: { temperature: 0.2, topP: 0.9, maxOutputTokens: 512 },
};

describe("buildChatCompletionParams", () => {
  it("组装非流式 body", () => {
    const body = buildChatCompletionParams("gpt-test", baseRequest);
    expect(body.stream).toBe(false);
    expect(body.model).toBe("gpt-test");
    expect(body.max_tokens).toBe(512);
    expect(body.temperature).toBe(0.2);
    expect(body.top_p).toBe(0.9);
    expect(body.messages[0]).toEqual({ role: "system", content: "sys" });
    expect(body.messages[1]).toMatchObject({ role: "user", content: "ping" });
  });
});

describe("buildStreamingChatCompletionParams", () => {
  it("开启 stream 与 include_usage", () => {
    const body = buildStreamingChatCompletionParams("m", baseRequest);
    expect(body.stream).toBe(true);
    expect(body.stream_options).toEqual({ include_usage: true });
  });
});
