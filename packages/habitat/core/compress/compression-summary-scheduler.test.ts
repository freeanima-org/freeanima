import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import {
  Config,
  bindActiveRuntimeConfig,
  resetActiveConfigForTest,
} from "@freeanima/habitat/core/config";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/world-context";
import * as llm from "@freeanima/habitat/core/llm";
import type { CompressionState } from "@freeanima/habitat/core/db/domain";

const patchCalls: CompressionState[] = [];

mock.module("@freeanima/habitat/core/db/pg", () => ({
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/habitat/core/db/pg/auto-llm-run", () => ({
  insertRunningAutoLlmRun: mock(async () => {}),
  appendAutoLlmMessages: mock(async () => {}),
  finishAutoLlmRun: mock(async () => {}),
  appendAutoLlmRun: mock(async () => {}),
  abortOrphanAutoLlmRuns: mock(async () => ({ aborted: 0 })),
  purgeStaleAutoLlmRuns: mock(async () => ({ deleted: 0 })),
  listAutoLlmRuns: mock(async () => []),
  countAutoLlmRuns: mock(async () => 0),
  getAutoLlmRun: mock(async () => null),
  listAutoLlmMessages: mock(async () => []),
}));

mock.module("@freeanima/habitat/core/db/pg/conversation", () => ({
  listMessagesByPosRange: mock(async () => [
    { role: "user", content: "hello", pos: 2 },
    { role: "assistant", content: "world", pos: 3 },
  ]),
  patchConversationMeta: mock(async (_id: string, patch: { compression?: CompressionState }) => {
    if (patch.compression) patchCalls.push(patch.compression);
  }),
}));

import {
  abandonCompressionSummaries,
  flushCompressionSummaries,
  resetCompressionSummaryPostCutForTests,
  scheduleCompressionSummary,
} from "./compression-summary-scheduler.ts";

describe("scheduleCompressionSummary writeback", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    patchCalls.length = 0;
    resetCompressionSummaryPostCutForTests();
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      commons_world_id: 30,
    });
    bindActiveRuntimeConfig(
      Config.fromSnapshot({
        connections: {
          main: {
            preset: "custom" as const,
            custom_kind: "text" as const,
            text_protocol: "openai_compatible" as const,
            base_url: "https://api.openai.com/v1",
            api_key: "test",
          },
        },
        text_generate: { main: { connection: "main", model: "gpt-x" } },
        compression: { enabled: true, summary_max_tokens: 400 },
      }),
    );
  });

  afterEach(async () => {
    abandonCompressionSummaries();
    await flushCompressionSummaries();
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    resetActiveConfigForTest();
    resetResolvedWorldContextForTest();
    resetCompressionSummaryPostCutForTests();
  });

  it("writes non-empty summary into compression meta on success", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({
      content: "I discussed login fixes.",
    });
    restores.push(chatSpy);

    const cut: CompressionState = { l2: 3, l3: 3 };
    scheduleCompressionSummary("conv-a", null, cut, "sys");
    const job = await flushCompressionSummaries("conv-a");

    expect(job?.ok).toBe(true);
    expect(job?.summary).toBe("I discussed login fixes.");
    expect(patchCalls.at(-1)?.summary).toBe("I discussed login fixes.");
    expect(chatSpy.mock.calls[0]?.[1]?.model).toBeUndefined();
  });

  it("returns ok:false with runId when LLM returns empty, without inventing summary", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "" });
    restores.push(chatSpy);

    const cut: CompressionState = { l2: 3, l3: 3 };
    scheduleCompressionSummary("conv-b", null, cut, "sys");
    const job = await flushCompressionSummaries("conv-b");

    expect(job?.ok).toBe(false);
    expect(job?.runId).toMatch(/^autollm_/);
    expect(patchCalls.at(-1)?.summary).toBeUndefined();
  });

  it("abandonCompressionSummaries clears pending so flush returns immediately", async () => {
    const prevHome = process.env.FREEANIMA_HOME;
    process.env.FREEANIMA_HOME = "/tmp/anima-compress-abandon";

    const holder: { resolve?: (v: { content: string }) => void } = {};
    const chatSpy = spyOn(llm, "chat").mockImplementation(
      () =>
        new Promise<{ content: string }>((resolve) => {
          holder.resolve = resolve;
        }),
    );
    restores.push(chatSpy);

    const cut: CompressionState = { l2: 3, l3: 3 };
    scheduleCompressionSummary("conv-hang", null, cut, "sys");
    for (let i = 0; i < 50 && chatSpy.mock.calls.length === 0; i++) {
      await new Promise<void>((r) => {
        setTimeout(r, 5);
      });
    }
    expect(holder.resolve).toBeDefined();

    abandonCompressionSummaries();
    const started = Date.now();
    await flushCompressionSummaries();
    expect(Date.now() - started).toBeLessThan(500);

    // 防止 abandon 后晚到的任务写库
    process.env.FREEANIMA_HOME = "/tmp/anima-compress-abandon-gone";
    holder.resolve!({ content: "late" });
    await new Promise<void>((r) => {
      setTimeout(r, 50);
    });
    expect(patchCalls).toHaveLength(0);

    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });

  it("skips writeback when FREEANIMA_HOME changes after LLM returns", async () => {
    const prevHome = process.env.FREEANIMA_HOME;
    process.env.FREEANIMA_HOME = "/tmp/anima-compress-home-a";

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const chatSpy = spyOn(llm, "chat").mockImplementation(async () => {
      await gate;
      return { content: "should not write" };
    });
    restores.push(chatSpy);

    const cut: CompressionState = { l2: 3, l3: 3 };
    scheduleCompressionSummary("conv-home", null, cut, "sys");
    for (let i = 0; i < 50 && chatSpy.mock.calls.length === 0; i++) {
      await new Promise<void>((r) => {
        setTimeout(r, 5);
      });
    }
    expect(chatSpy.mock.calls.length).toBeGreaterThan(0);

    process.env.FREEANIMA_HOME = "/tmp/anima-compress-home-b";
    release();
    const job = await flushCompressionSummaries("conv-home");

    expect(job?.ok).toBe(false);
    expect(job?.error).toContain("FREEANIMA_HOME changed");
    expect(patchCalls).toHaveLength(0);

    if (prevHome === undefined) delete process.env.FREEANIMA_HOME;
    else process.env.FREEANIMA_HOME = prevHome;
  });
});
