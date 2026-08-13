import { describe, it, expect, spyOn, afterAll, afterEach, mock } from "bun:test";
import * as loopEngine from "@freeanima/host/engine/loop";
import * as conv from "@freeanima/host/engine/conversation";
import type { AutoLlmRunAppendInput } from "@freeanima/host/core/db/pg/auto-llm-run/types";
import { Config } from "@freeanima/host/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/host/engine";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/host/core/llm";
import { bindLlmStack } from "@freeanima/host/capabilities/llm-openai";
import { createTestLogger } from "@freeanima/host/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/host/platform/bootstrap";
import { parseYaml } from "@freeanima/host/platform/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";
import { createConversationService } from "@freeanima/host/engine/conversation";

const appendCalls: AutoLlmRunAppendInput[] = [];

// 先捕获真实实现，mock 后在 afterAll 恢复，避免 mock.module 全局泄漏污染其他测试文件。
const realPg = await import("@freeanima/host/core/db/pg");
const pgOriginal = { ...realPg };
const realAutoLlmRun = await import("@freeanima/host/core/db/pg/auto-llm-run");
const autoLlmRunOriginal = { ...realAutoLlmRun };

mock.module("@freeanima/host/core/db/pg", () => ({
  ...pgOriginal,
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/host/core/db/pg/auto-llm-run", () => ({
  ...autoLlmRunOriginal,
  appendAutoLlmRun: mock(async (row: AutoLlmRunAppendInput) => {
    appendCalls.push(row);
  }),
  purgeStaleAutoLlmRuns: mock(async () => ({ deleted: 0 })),
  listAutoLlmRuns: mock(async () => []),
  countAutoLlmRuns: mock(async () => 0),
  getAutoLlmRun: mock(async () => null),
  listAutoLlmMessages: mock(async () => []),
}));

afterAll(() => {
  mock.module("@freeanima/host/core/db/pg", () => pgOriginal);
  mock.module("@freeanima/host/core/db/pg/auto-llm-run", () => autoLlmRunOriginal);
});

import { runAutoLlm } from "./auto-llm-run.ts";
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

describe("runAutoLlm", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    appendCalls.length = 0;
  });

  it("does not write conversation or messages; persists auto_llm_runs", async () => {
    async function* fakeStream() {
      yield { event: "token" as const, data: { content: "cron done" } };
    }
    const streamSpy = spyOn(loopEngine, "runStream").mockImplementation(() => fakeStream());
    const appendMsg = spyOn(conv, "appendMessage").mockResolvedValue(undefined);
    restores.push(streamSpy, appendMsg);

    const deps = bindTestDeps();
    const result = await runAutoLlm(deps, {
      runName: "test-cron",
      runKind: "cron",
      subjectId: 2,
      systemPrompt: "sys",
      userMessages: ["do task"],
      toolNames: [],
      maxTurns: 5,
    });

    expect(result.status).toBe("ok");
    expect(result.output).toBe("cron done");
    expect(appendMsg).not.toHaveBeenCalled();
    expect(appendCalls.length).toBe(1);
    expect(appendCalls[0]?.run_kind).toBe("cron");
    expect(appendCalls[0]?.subject_id).toBe(2);
    expect(appendCalls[0]?.status).toBe("ok");
    expect(appendCalls[0]?.messages?.length).toBeGreaterThan(0);
    expect(appendCalls[0]?.messages?.some((m) => m.payload.role === "system")).toBe(true);
    expect(appendCalls[0]?.messages?.some((m) => m.payload.role === "user")).toBe(true);
  });
});
