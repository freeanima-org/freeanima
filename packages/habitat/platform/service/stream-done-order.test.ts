import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/habitat/engine/conversation";
import * as turn from "@freeanima/habitat/engine/turn";
import * as engine from "@freeanima/habitat/kernel/loop-mechanism";
import type { StreamEvent } from "@freeanima/habitat/kernel/loop-mechanism";
import { createConversationService } from "@freeanima/habitat/engine/conversation";
import { Config } from "@freeanima/habitat/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/habitat/engine";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/habitat/core/llm";
import { bindLlmStack } from "@freeanima/habitat/capabilities/llm-openai";
import { createTestLogger } from "@freeanima/habitat/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/habitat/platform/bootstrap";
import { parseYaml } from "@freeanima/habitat/platform/config";
import { runtimeConfigSchema } from "@freeanima/habitat/core/config";
import { MINIMAL_LLM_YAML } from "@freeanima/habitat/platform/config/test-helpers/minimal-llm-config";
import { createAppRuntime } from "./app-runtime.ts";
import * as conversationTitle from "./conversation-title.ts";
import { initRuntimeContext } from "../context.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(runtimeConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(bindLlmStack);
const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function bindTestRuntime() {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  const runtime = createAppRuntime({
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    outpost: null,
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
