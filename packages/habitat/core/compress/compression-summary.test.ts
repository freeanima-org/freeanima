import { describe, it, expect, spyOn, afterEach, beforeEach, afterAll, mock } from "bun:test";
import * as llm from "@freeanima/habitat/core/llm";
import {
  Config,
  bindActiveRuntimeConfig,
  resetActiveConfigForTest,
} from "@freeanima/habitat/core/config";
import {
  bindResolvedWorldContext,
  resetResolvedWorldContextForTest,
} from "@freeanima/habitat/core/config/world-context";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import {
  COMPRESSION_SUMMARY_REQUEST_PARAMS,
  generateConversationSummary,
} from "./compression-summary.ts";
import type { CompressionState } from "./compressor.ts";

const realPg = await import("@freeanima/habitat/core/db/pg");
const pgOriginal = { ...realPg };
const realAutoLlmRun = await import("@freeanima/habitat/core/db/pg/auto-llm-run");
const autoLlmRunOriginal = { ...realAutoLlmRun };

mock.module("@freeanima/habitat/core/db/pg", () => ({
  ...pgOriginal,
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/habitat/core/db/pg/auto-llm-run", () => ({
  ...autoLlmRunOriginal,
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

afterAll(() => {
  mock.module("@freeanima/habitat/core/db/pg", () => pgOriginal);
  mock.module("@freeanima/habitat/core/db/pg/auto-llm-run", () => autoLlmRunOriginal);
});

function msg(role: StoredMessage["role"], pos: number, content: string): StoredMessage {
  return { role, content, pos } as StoredMessage;
}

describe("COMPRESSION_SUMMARY_REQUEST_PARAMS", () => {
  it("disables thinking and tool calls for one-shot summary", () => {
    expect(COMPRESSION_SUMMARY_REQUEST_PARAMS.extra.thinking).toEqual({ type: "disabled" });
    expect(COMPRESSION_SUMMARY_REQUEST_PARAMS.extra.tool_choice).toBe("none");
  });
});

describe("generateConversationSummary", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  beforeEach(() => {
    bindResolvedWorldContext({
      user_subject_id: 1,
      agent_subject_id: 2,
      user_world_id: 10,
      agent_world_id: 20,
      default_chat_agent_subject_id: 2,
      default_chat_agent_world_id: 20,
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

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    resetActiveConfigForTest();
    resetResolvedWorldContextForTest();
  });

  it("passes one-shot requestParams via runAutoLlmChat", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "I fixed login." });
    restores.push(chatSpy);

    const messages = [msg("user", 2, "fix login"), msg("assistant", 3, "done")];
    const newState: CompressionState = { l2: 3, l3: 3 };

    const result = await generateConversationSummary(messages, null, newState, "sys", {
      preSliced: true,
      model: "test-model",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.summary).toBe("I fixed login.");
    expect(chatSpy).toHaveBeenCalledTimes(1);
    const [, opts] = chatSpy.mock.calls[0]!;
    expect(opts?.profileId).toBe(llm.PROFILE_SUMMARY);
    expect(opts?.model).toBe("test-model");
    expect(opts?.requestParams).toEqual(COMPRESSION_SUMMARY_REQUEST_PARAMS);
  });

  it("omits model override so PROFILE_SUMMARY hop is used", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "ok" });
    restores.push(chatSpy);

    await generateConversationSummary(
      [msg("user", 2, "hi"), msg("assistant", 3, "yo")],
      null,
      { l2: 3, l3: 3 },
      "sys",
      { preSliced: true },
    );

    const [, opts] = chatSpy.mock.calls[0]!;
    expect(opts?.profileId).toBe(llm.PROFILE_SUMMARY);
    expect(opts?.model).toBeUndefined();
  });

  it("returns runId when LLM output is empty", async () => {
    const chatSpy = spyOn(llm, "chat").mockResolvedValue({ content: "  " });
    restores.push(chatSpy);

    const result = await generateConversationSummary(
      [msg("user", 2, "hi"), msg("assistant", 3, "yo")],
      null,
      { l2: 3, l3: 3 },
      "sys",
      { preSliced: true, model: "test-model" },
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("empty");
      expect(result.runId).toMatch(/^autollm_/);
    }
  });
});
