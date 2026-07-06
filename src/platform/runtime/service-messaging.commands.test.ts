import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/runtime/conversation";
import * as turn from "@freeanima/runtime/turn";
import type { StreamEvent } from "@freeanima/runtime/loop";
import { createConversationService } from "@freeanima/runtime/conversation";
import { MaskRegistry } from "@freeanima/feature-task/domain/mask";
import { Config } from "@freeanima/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/runtime";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/core/llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-llm-openai";
import { createTestLogger } from "@freeanima/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import { parseYaml } from "@freeanima/platform/config";
import { animaConfigSchema } from "@freeanima/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { registerBuiltins } from "@freeanima/platform/commands";
import * as turnLifecycle from "./turn-lifecycle.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(animaConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

async function wireTestRuntime() {
  registerBuiltins();
  const { createAppRuntime } = await import("./app-runtime.ts");
  const { initRuntimeContext } = await import("../context.ts");
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  getAcpManager().wireRegistries({
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config: testConfig,
  });
  getAcpManager().wireConversation(conversation);
  const runtime = createAppRuntime({
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    satellite: null,
    acp: getAcpManager(),
    masks: new MaskRegistry(),
    host: "127.0.0.1",
    port: 2658,
  });
  initRuntimeContext(runtime);
  return runtime;
}

describe("sendMessageStream slash commands", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  function mockConversationBasics(): void {
    restores.push(
      spyOn(conv, "conversationExists").mockResolvedValue(true),
      spyOn(conv, "assertConversationPlatform").mockResolvedValue(),
      spyOn(conv, "loadConversationMeta").mockResolvedValue({
        role: "conversation_meta",
        model: "test-model",
        cached_toolsets: [],
        functions: [],
        timestamp: new Date().toISOString(),
        platform: "sap:chat:test",
      }),
    );
  }

  it("/retry yields stream pre-ack before engine tokens", async () => {
    restores.push(
      spyOn(turnLifecycle, "runExclusiveStreamTurn").mockImplementation(
        async function* (): AsyncGenerator<StreamEvent> {
          yield { event: "token", data: { content: "new reply" } };
          yield { event: "done", data: {} };
        },
      ),
    );
    mockConversationBasics();
    restores.push(
      spyOn(turn, "retryTurn").mockResolvedValue([
        [{ role: "user", content: "hi" }],
        [],
        "hi",
      ] as never),
    );

    const app = await wireTestRuntime();
    const tokens: string[] = [];
    for await (const ev of app.sendMessageStream("test-sid", "/retry", "sap:chat:test")) {
      if (ev.event === "token") tokens.push(ev.data.content);
    }

    expect(tokens.length).toBeGreaterThanOrEqual(2);
    expect(tokens[0]).toContain("重新生成");
    expect(tokens.at(-1)).toContain("new reply");
  });

  it("/help never yields empty token content", async () => {
    mockConversationBasics();

    const app = await wireTestRuntime();
    const tokens: string[] = [];
    for await (const ev of app.sendMessageStream("test-sid", "/help", "sap:chat:test")) {
      if (ev.event === "token") tokens.push(ev.data.content);
    }

    expect(tokens.some((t) => t.trim().length > 0)).toBe(true);
  });

  it("/compress yields pre-ack before handler result", async () => {
    mockConversationBasics();
    let handlerStarted = false;
    restores.push(
      spyOn(turn, "recompressConversation").mockImplementation(async () => {
        handlerStarted = true;
        return {
          enabled: true,
          updated: true,
          l2: "x",
          l3: null,
          stored_total: 1,
          runtime_message_count: 1,
          hidden_by_compression: 0,
          window_raw: 1,
          recompress_at: 10,
          threshold: 5,
          messages_until_recompress: 3,
          rounds_until_recompress: 1,
        };
      }),
    );

    const app = await wireTestRuntime();
    const tokens: string[] = [];
    for await (const ev of app.sendMessageStream("test-sid", "/compress", "sap:chat:test")) {
      if (ev.event === "token") tokens.push(ev.data.content);
    }

    expect(tokens[0]).toContain("压缩");
    expect(handlerStarted).toBe(true);
    expect(tokens.some((t) => t.includes("Updated compression") || t.includes("l2"))).toBe(true);
  });
});
