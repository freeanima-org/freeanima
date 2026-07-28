import { afterEach, describe, expect, it, spyOn } from "bun:test";
import * as conv from "@freeanima/host/engine/conversation";
import * as turn from "@freeanima/host/engine/turn";
import * as engine from "@freeanima/host/engine/loop";
import type { StreamEvent } from "@freeanima/host/engine/loop";
import { createConversationService } from "@freeanima/host/engine/conversation";
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
import { createAppRuntime } from "./app-runtime.ts";
import * as conversationTitle from "./conversation-title.ts";
import { initRuntimeContext } from "../context.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(runtimeConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
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
    outpost: null,
    acp: getAcpManager(),
    host: "127.0.0.1",
    port: 2658,
  });
  initRuntimeContext(runtime);
  return runtime;
}

describe("sendMessageStream client_op_id in-flight idempotency", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  function mockBasics(findResult: unknown): void {
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
      spyOn(conv, "getMaxMessagePos").mockResolvedValue(0),
      spyOn(conv, "findUserMessageByClientOpId").mockResolvedValue(findResult as never),
      spyOn(conv, "load").mockResolvedValue([]),
      spyOn(turn, "beginTurnFast").mockResolvedValue("hello"),
      spyOn(turn, "beginTurnPrepare").mockResolvedValue([[{ role: "user", content: "hello" }], []]),
      spyOn(conv, "loadConversationTools").mockResolvedValue([]),
      spyOn(turn, "finishTurn").mockResolvedValue(undefined),
    );
  }

  it("并发同 client_op_id：第二路只 accepted+done，不重跑 turn", async () => {
    mockBasics(null);

    let runStreamCalls = 0;
    let enteredRun!: () => void;
    const runEntered = new Promise<void>((resolve) => {
      enteredRun = resolve;
    });
    restores.push(
      spyOn(engine, "runStream").mockImplementation(
        async function* (): AsyncGenerator<StreamEvent> {
          runStreamCalls += 1;
          enteredRun();
          yield { event: "token", data: { content: "reply" } };
          await new Promise<void>((resolve) => {
            setTimeout(resolve, 40);
          });
          yield { event: "done", data: {} };
        },
      ),
    );

    const app = bindTestRuntime();
    const origin = {
      client_op_id: "dup-op-1",
      expected_tail_pos: 0,
    };

    const first = (async () => {
      const events: string[] = [];
      for await (const ev of app.sendMessageStream("sid", "hello", "chat", origin)) {
        events.push(ev.event);
      }
      return events;
    })();

    await runEntered;

    const secondEvents: string[] = [];
    for await (const ev of app.sendMessageStream("sid", "hello", "chat", origin)) {
      secondEvents.push(ev.event);
    }

    const firstEvents = await first;
    expect(runStreamCalls).toBe(1);
    expect(firstEvents).toContain("token");
    expect(secondEvents).toEqual(["accepted", "done"]);
  });

  it("turn 已完成时直接 accepted+done", async () => {
    mockBasics({ role: "user", content: "hello", pos: 1 });
    restores.push(
      spyOn(conv, "load").mockResolvedValue([
        { role: "user", content: "hello", pos: 1 },
        { role: "assistant", content: "done reply", pos: 2 },
      ] as never),
    );

    const runStream = spyOn(engine, "runStream").mockImplementation(
      async function* (): AsyncGenerator<StreamEvent> {
        yield { event: "done", data: {} };
      },
    );
    restores.push(runStream);

    const app = bindTestRuntime();
    const events: string[] = [];
    for await (const ev of app.sendMessageStream("sid", "hello", "chat", {
      client_op_id: "done-op",
    })) {
      events.push(ev.event);
    }

    expect(events).toEqual(["accepted", "done"]);
    expect(runStream).not.toHaveBeenCalled();
  });
});
