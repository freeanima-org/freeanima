import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  Config,
  bindActiveRuntimeConfig,
  resetActiveConfigForTest,
} from "@freeanima/host/core/config";
import * as llm from "@freeanima/host/core/llm";
import type { CompressionState } from "@freeanima/host/core/db/domain";

const patchCalls: CompressionState[] = [];

mock.module("@freeanima/host/core/db/pg/conversation", () => ({
  listMessagesByPosRange: mock(async () => [
    { role: "user", content: "hello", pos: 2 },
    { role: "assistant", content: "world", pos: 3 },
  ]),
  patchConversationMeta: mock(async (_id: string, patch: { compression?: CompressionState }) => {
    if (patch.compression) patchCalls.push(patch.compression);
  }),
}));

import {
  flushCompressionSummaries,
  resetCompressionSummaryPostCutForTests,
  scheduleCompressionSummary,
} from "./compression-summary-scheduler.ts";

describe("scheduleCompressionSummary writeback", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    patchCalls.length = 0;
    resetCompressionSummaryPostCutForTests();
    bindActiveRuntimeConfig(
      Config.fromSnapshot({
        llm: {
          default_profile: "chat",
          providers: {
            main: {
              backend: "openai_compatible" as const,
              base_url: "https://api.openai.com/v1",
              api_key: "test",
            },
          },
          profiles: { chat: { chain: [{ provider: "main", model: "gpt-x" }] } },
        },
        compression: { enabled: true, summary_max_tokens: 400 },
      }),
    );
  });

  afterEach(async () => {
    await flushCompressionSummaries();
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    resetActiveConfigForTest();
    resetCompressionSummaryPostCutForTests();
  });

  it("writes non-empty summary into compression meta on success", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({
      content: "I discussed login fixes.",
    } as never);
    restores.push(chatSpy);

    const cut: CompressionState = { l2: 3, l3: 3 };
    scheduleCompressionSummary("conv-a", null, cut, "sys", "test-model");
    const job = await flushCompressionSummaries("conv-a");

    expect(job?.ok).toBe(true);
    expect(job?.summary).toBe("I discussed login fixes.");
    expect(patchCalls.at(-1)?.summary).toBe("I discussed login fixes.");
  });

  it("returns ok:false with runId when LLM returns empty, without inventing summary", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "" } as never);
    restores.push(chatSpy);

    const cut: CompressionState = { l2: 3, l3: 3 };
    scheduleCompressionSummary("conv-b", null, cut, "sys", "test-model");
    const job = await flushCompressionSummaries("conv-b");

    expect(job?.ok).toBe(false);
    expect(job?.runId).toMatch(/^autollm_/);
    expect(patchCalls.at(-1)?.summary).toBeUndefined();
  });
});
