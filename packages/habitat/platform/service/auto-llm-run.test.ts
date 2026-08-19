import { describe, it, expect, spyOn, afterAll, afterEach, mock } from "bun:test";
import * as loopEngine from "@freeanima/habitat/kernel/loop-mechanism";
import * as conv from "@freeanima/habitat/engine/conversation";
import type {
  AutoLlmMessageAppendInput,
  AutoLlmRunFinishInput,
  AutoLlmRunInsertRunningInput,
} from "@freeanima/habitat/core/db/pg/auto-llm-run/types";
import { Config } from "@freeanima/habitat/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/habitat/engine";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/habitat/core/llm";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import { createTestLogger } from "@freeanima/habitat/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/habitat/platform/bootstrap";
import { parseYaml } from "@freeanima/habitat/platform/config";
import { runtimeConfigSchema } from "@freeanima/habitat/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/habitat/platform/config/test-helpers/minimal-llm-config";
import { createConversationService } from "@freeanima/habitat/engine/conversation";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";

const persistLog: string[] = [];
const insertCalls: AutoLlmRunInsertRunningInput[] = [];
const appendCalls: Array<{ runId: string; msgs: AutoLlmMessageAppendInput[] }> = [];
const finishCalls: AutoLlmRunFinishInput[] = [];

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
  insertRunningAutoLlmRun: mock(async (row: AutoLlmRunInsertRunningInput) => {
    persistLog.push("insert");
    insertCalls.push(row);
  }),
  appendAutoLlmMessages: mock(async (runId: string, msgs: AutoLlmMessageAppendInput[]) => {
    persistLog.push("append");
    appendCalls.push({ runId, msgs });
  }),
  finishAutoLlmRun: mock(async (row: AutoLlmRunFinishInput) => {
    persistLog.push("finish");
    finishCalls.push(row);
  }),
  appendAutoLlmRun: mock(async () => {}),
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

import { lastSuccessfulAssistantText, runAutoLlm } from "./auto-llm-run.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(runtimeConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(bindLlmStack);

const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function bindTestDeps(): FullRuntimeDeps {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  return {
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    outpost: null,
    host: "127.0.0.1",
    port: 2658,
  };
}

describe("lastSuccessfulAssistantText", () => {
  it("returns the last assistant content without tool_calls", () => {
    const messages: StoredMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "",
        tool_calls: [{ id: "c1", type: "function", function: { name: "search", arguments: "{}" } }],
      },
      { role: "tool", tool_call_id: "c1", content: "{}" },
      { role: "assistant", content: "  final answer  " },
    ];
    expect(lastSuccessfulAssistantText(messages)).toBe("final answer");
  });

  it("skips tool_calls assistants and empty content", () => {
    const messages: StoredMessage[] = [
      {
        role: "assistant",
        content: "partial",
        tool_calls: [{ id: "c1", type: "function", function: { name: "x", arguments: "{}" } }],
      },
      { role: "assistant", content: "   " },
    ];
    expect(lastSuccessfulAssistantText(messages)).toBe("");
  });
});

describe("runAutoLlm", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    persistLog.length = 0;
    insertCalls.length = 0;
    appendCalls.length = 0;
    finishCalls.length = 0;
  });

  it("does not write conversation; inserts running then appends and finishes", async () => {
    const streamSpy = spyOn(loopEngine, "runStream").mockImplementation((messages, opts) => {
      const assistant: StoredMessage = {
        role: "assistant",
        content: "cron done",
        usage: { prompt_tokens: 8, completion_tokens: 3, cached_tokens: 2 },
        latency_ms: 15,
      };
      messages.push(assistant);
      async function* fakeStream() {
        await opts?.onToolRoundComplete?.([assistant]);
        yield { event: "token" as const, data: { content: "cron done" } };
      }
      return fakeStream();
    });
    const appendMsg = spyOn(conv, "appendMessage").mockResolvedValue(undefined);
    restores.push(streamSpy, appendMsg);

    const deps = bindTestDeps();
    const result = await runAutoLlm(deps, {
      runName: "test-cron",
      runKind: "cron",
      subjectId: 2,
      systemPrompt: "sys",
      userMessages: ["do task"],
      toolNames: ["web_search"],
      maxLoopIterations: 5,
    });

    expect(result.status).toBe("ok");
    expect(result.output).toBe("cron done");
    expect(appendMsg).not.toHaveBeenCalled();

    expect(insertCalls.length).toBe(1);
    expect(insertCalls[0]?.run_kind).toBe("cron");
    expect(insertCalls[0]?.subject_id).toBe(2);
    expect(insertCalls[0]?.max_loop_iterations).toBe(5);
    expect(insertCalls[0]?.max_duration_ms).toBeNull();
    expect(insertCalls[0]?.metadata?.tool_names).toEqual(["web_search"]);
    expect(typeof insertCalls[0]?.metadata?.model).toBe("string");
    expect(insertCalls[0]?.messages?.some((m) => m.payload.role === "system")).toBe(true);
    expect(insertCalls[0]?.messages?.some((m) => m.payload.role === "user")).toBe(true);

    expect(appendCalls.length).toBeGreaterThan(0);
    expect(appendCalls.some((c) => c.msgs.some((m) => m.payload.role === "assistant"))).toBe(true);
    const assistantPayload = appendCalls
      .flatMap((c) => c.msgs)
      .find((m) => m.payload.role === "assistant")?.payload;
    expect(assistantPayload).toMatchObject({
      role: "assistant",
      usage: { prompt_tokens: 8, completion_tokens: 3, cached_tokens: 2 },
      latency_ms: 15,
    });

    expect(finishCalls.length).toBe(1);
    expect(finishCalls[0]?.status).toBe("ok");
    expect(finishCalls[0]?.output).toBe("cron done");
    expect(persistLog[0]).toBe("insert");
    expect(persistLog.at(-1)).toBe("finish");
  });
});
