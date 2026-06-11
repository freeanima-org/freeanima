import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/engine-conversation";
import * as engine from "@freeanima/engine-loop";
import type { StreamEvent } from "@freeanima/engine-loop";
import { createConversationService } from "@freeanima/engine-conversation";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { Config } from "@freeanima/engine-config";
import { createEngine, createEngineCatalog } from "@freeanima/engine";
import { initLlmRuntime, registerLlmStackConfigurator } from "@freeanima/engine-llm";
import { wireOpenAiCompatibleLlm } from "@freeanima/capabilities-provider-openai-compatible";
import { createTestLogger } from "@freeanima/kernel-logging/testing";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { parseYaml } from "@freeanima/service-config";
import { animaConfigSchema } from "@freeanima/service-config/schemas/config";
import { MINIMAL_LLM_YAML } from "@freeanima/service-config/test-helpers/minimal-llm-config";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { AnimaService } from "./anima-service.ts";
import { initServiceContext } from "../context.ts";

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

function wireTestService(): AnimaService {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(nullPgRepositories, catalog.toolSets);
  const service = new AnimaService({ kernel, conversation });
  getAcpManager().wireRegistries({
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config: testConfig,
  });
  getAcpManager().wireConversation(conversation);
  initServiceContext({
    service,
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    acp: getAcpManager(),
    masks: new MaskRegistry(),
    host: "127.0.0.1",
    port: 2658,
  });
  return service;
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
      spyOn(conv, "beginTurn").mockResolvedValue([
        [{ role: "user", content: "hello" }],
        [],
        "hello",
      ]),
      spyOn(conv, "loadSessionTools").mockResolvedValue([]),
    );

    let finishTurnStarted = false;
    let doneSeenBeforeFinishTurn = false;

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

    const svc = wireTestService();
    for await (const ev of svc.sendMessageStream("test-sid", "hello", "parlor")) {
      if (ev.event === "done") {
        doneSeenBeforeFinishTurn = !finishTurnStarted;
      }
    }

    expect(doneSeenBeforeFinishTurn).toBe(true);
    expect(finishTurnStarted).toBe(true);
  });
});
