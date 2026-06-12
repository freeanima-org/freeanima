import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/runtime/conversation";
import * as engine from "@freeanima/runtime/loop";
import type { StreamEvent } from "@freeanima/runtime/loop";
import { createConversationService } from "@freeanima/runtime/conversation";
import { nullPgRepositories } from "@freeanima/core/repos";
import { MaskRegistry } from "@freeanima/capabilities-tasks/mask";
import { Config } from "@freeanima/core/config";
import { createEngine, createEngineCatalog } from "@freeanima/runtime";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/core/llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-llm-openai";
import { createTestLogger } from "@freeanima/kernel/logging/testing";
import { createServiceKernel } from "@freeanima/platform/bootstrap";
import { parseYaml } from "@freeanima/platform/config";
import { animaConfigSchema } from "@freeanima/platform/config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/platform/config/test-helpers/minimal-llm-config";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { createAppRuntime } from "./app-runtime.ts";
import { initRuntimeContext } from "../context.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(animaConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
const testEngine = createEngine({
  catalog,
  repos: nullPgRepositories,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function wireTestRuntime() {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(nullPgRepositories, catalog.toolSets);
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
      spyOn(conv, "sessionExists").mockResolvedValue(true),
      spyOn(conv, "assertSessionPlatform").mockResolvedValue(undefined),
      spyOn(conv, "beginTurnFast").mockResolvedValue("hello"),
      spyOn(conv, "beginTurnPrepare").mockResolvedValue([[{ role: "user", content: "hello" }], []]),
      spyOn(conv, "loadSessionTools").mockResolvedValue([]),
    );

    let finishTurnStarted = false;
    const eventOrder: string[] = [];

    restores.push(
      spyOn(conv, "finishTurn").mockImplementation(async () => {
        finishTurnStarted = true;
        await new Promise((r) => setTimeout(r, 50));
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

    const app = wireTestRuntime();
    for await (const ev of app.sendMessageStream("test-sid", "hello", "parlor")) {
      eventOrder.push(ev.event);
    }

    expect(eventOrder.indexOf("accepted")).toBeLessThan(eventOrder.indexOf("token"));
    expect(eventOrder.indexOf("token")).toBeLessThan(eventOrder.indexOf("done"));
    expect(eventOrder.at(-1)).toBe("done");
    expect(finishTurnStarted).toBe(true);
  });
});
