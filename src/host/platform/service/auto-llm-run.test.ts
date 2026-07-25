import { describe, it, expect, spyOn, afterEach, mock } from "bun:test";
import * as loopEngine from "@freeanima/host/engine/loop";
import * as conv from "@freeanima/host/engine/conversation";
import type { AutoLlmRunAppendInput } from "@freeanima/host/core/db/pg/auto-llm-run/types";
import { Config } from "@freeanima/host/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/host/engine";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/host/core/llm";
import { bindOpenAiCompatibleLlm } from "@freeanima/host/capabilities/llm-openai";
import { createTestLogger } from "@freeanima/host/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/host/platform/bootstrap";
import { parseYaml } from "@freeanima/host/platform/config";
import { runtimeConfigSchema } from "@freeanima/host/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/host/platform/config/test-helpers/minimal-llm-config";
import { getAcpManager } from "@freeanima/host/capabilities/acp";
import { createConversationService } from "@freeanima/host/engine/conversation";
import { MaskRegistry } from "@freeanima/host/core/mask";

const appendCalls: AutoLlmRunAppendInput[] = [];

mock.module("@freeanima/host/core/db/pg", () => ({
  isPostgresPrimary: () => true,
}));

mock.module("@freeanima/host/core/db/pg/auto-llm-run", () => ({
  appendAutoLlmRun: mock(async (row: AutoLlmRunAppendInput) => {
    appendCalls.push(row);
  }),
  purgeStaleAutoLlmRuns: mock(async () => ({ deleted: 0 })),
  listAutoLlmRuns: mock(async () => []),
  countAutoLlmRuns: mock(async () => 0),
}));

import { runAutoLlm } from "./auto-llm-run.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(runtimeConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(bindOpenAiCompatibleLlm);

const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function bindTestDeps(): FullRuntimeDeps {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  getAcpManager().bindRegistries({
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config: testConfig,
  });
  getAcpManager().bindConversation(conversation);
  return {
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    outpost: null,
    acp: getAcpManager(),
    masks: new MaskRegistry(),
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
    const appendMsg = spyOn(conv, "appendMessage").mockResolvedValue(undefined as never);
    restores.push(streamSpy, appendMsg);

    const deps = bindTestDeps();
    const result = await runAutoLlm(deps, {
      runName: "test-cron",
      runKind: "cron",
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
    expect(appendCalls[0]?.status).toBe("ok");
  });
});
