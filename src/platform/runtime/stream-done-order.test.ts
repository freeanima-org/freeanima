import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/runtime/conversation";
import * as turn from "@freeanima/runtime/turn";
import * as engine from "@freeanima/runtime/loop";
import type { StreamEvent } from "@freeanima/runtime/loop";
import { createConversationService } from "@freeanima/runtime/conversation";
import { MaskRegistry } from "@freeanima/features/task/domain/mask";
import { Config } from "@freeanima/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/runtime";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/core/llm";
import { bindOpenAiCompatibleLlm } from "@freeanima/capabilities/llm-openai";
import { createTestLogger } from "@freeanima/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import { parseYaml } from "@freeanima/platform/config";
import { animaConfigSchema } from "@freeanima/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";
import { getAcpManager } from "@freeanima/capabilities/acp";
import { createAppRuntime } from "./app-runtime.ts";
import * as conversationTitle from "./conversation-title.ts";
import { initRuntimeContext } from "../context.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(animaConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(bindOpenAiCompatibleLlm);
const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function bindTestRuntime() {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  getAcpManager().bindRegistries({
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config: testConfig,
  });
  getAcpManager().bindConversation(conversation);
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

describe("sendMessageStream done order", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("done yields to consumer before finishTurn starts", async () => {
    restores.push(
      spyOn(conversationTitle, "triggerConversationTitleIfFirstTurn").mockResolvedValue(undefined),
      spyOn(conv, "conversationExists").mockResolvedValue(true),
      spyOn(conv, "assertConversationPlatform").mockResolvedValue(),
      spyOn(conv, "loadConversationMeta").mockResolvedValue({
        role: "conversation_meta",
        model: "test",
        cached_toolsets: [],
        functions: [],
        timestamp: "",
        platform: "chat",
      }),
      spyOn(turn, "beginTurnFast").mockResolvedValue("hello"),
      spyOn(turn, "beginTurnPrepare").mockResolvedValue([[{ role: "user", content: "hello" }], []]),
      spyOn(conv, "loadConversationTools").mockResolvedValue([]),
    );

    let finishTurnStarted = false;
    const eventOrder: string[] = [];

    restores.push(
      spyOn(turn, "finishTurn").mockImplementation(async () => {
        finishTurnStarted = true;
        await new Promise((r) => {
          setTimeout(r, 50);
        });
      }),
    );

    restores.push(
      spyOn(engine, "runStream").mockImplementation(
        async function* (): AsyncGenerator<StreamEvent> {
          yield { event: "token", data: { content: "reply" } };
          yield { event: "done", data: {} };
        },
      ),
    );

    const app = bindTestRuntime();
    for await (const ev of app.sendMessageStream("test-sid", "hello", "chat")) {
      eventOrder.push(ev.event);
    }

    expect(eventOrder.indexOf("accepted")).toBeLessThan(eventOrder.indexOf("token"));
    expect(eventOrder.indexOf("token")).toBeLessThan(eventOrder.indexOf("done"));
    expect(eventOrder.at(-1)).toBe("done");
    expect(finishTurnStarted).toBe(true);
  });
});
