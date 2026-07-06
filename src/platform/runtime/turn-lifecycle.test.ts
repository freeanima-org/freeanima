import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as engine from "@freeanima/runtime/loop";
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
import { createTurnMessageCallbacks, finalizeTurn, runSimpleTurn } from "./turn-lifecycle.ts";
import type { FullRuntimeDeps } from "./runtime-deps.ts";

const catalog = createEngineCatalog();
const testConfig = Config.fromSnapshot(animaConfigSchema.parse(parseYaml(MINIMAL_LLM_YAML)));
registerLlmStackConfigurator(wireOpenAiCompatibleLlm);
const testEngine = createEngine({
  catalog,
  config: testConfig,
  llm: initLlmRuntime(testConfig.data),
  logger: createTestLogger(),
});

function wireTestDeps(): FullRuntimeDeps {
  const kernel = createServiceKernel(testConfig);
  const conversation = createConversationService(catalog.toolSets);
  getAcpManager().wireRegistries({
    toolSets: catalog.toolSets,
    skills: catalog.skills,
    config: testConfig,
  });
  getAcpManager().wireConversation(conversation);
  return {
    kernel,
    engine: testEngine,
    conversation,
    mcp: null,
    satellite: null,
    acp: getAcpManager(),
    masks: new MaskRegistry(),
    host: "127.0.0.1",
    port: 2658,
  };
}

describe("turn-lifecycle", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("createTurnMessageCallbacks writes appendMessage", async () => {
    const deps = wireTestDeps();
    const append = spyOn(deps.conversation, "appendMessage").mockResolvedValue();
    restores.push(append);

    const cb = createTurnMessageCallbacks(deps, "sid-1");
    await cb.onMessageAppended({ role: "assistant", content: "hi" });
    await cb.onToolRoundComplete([{ role: "tool", tool_call_id: "1", name: "t", content: "{}" }]);

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(1, { role: "assistant", content: "hi" }, "sid-1");
  });

  it("finalizeTurn calls finishTurn with skipMessageAppend", async () => {
    const deps = wireTestDeps();
    const finish = spyOn(deps.conversation, "finishTurn").mockResolvedValue();
    restores.push(finish);

    const msgs = [{ role: "user" as const, content: "q" }];
    await finalizeTurn(deps, "sid-2", msgs, "q", "model-x", ["fn"]);

    expect(finish).toHaveBeenCalledWith("sid-2", msgs, "q", "model-x", ["fn"], true);
  });

  it("runSimpleTurn goes beginTurn → run → finishTurn", async () => {
    const msgs = [{ role: "user" as const, content: "cron prompt" }];
    const deps = wireTestDeps();
    restores.push(
      spyOn(deps.conversation, "beginTurn").mockResolvedValue([msgs, ["tool_a"], "cron prompt"]),
      spyOn(deps.conversation, "loadConversationTools").mockResolvedValue([]),
      spyOn(deps.conversation, "loadConversationMeta").mockResolvedValue({
        role: "conversation_meta",
        model: "m1",
        cached_toolsets: [],
        functions: ["tool_a"],
        timestamp: "",
      }),
      spyOn(deps.conversation, "appendMessage").mockResolvedValue(),
      spyOn(deps.conversation, "finishTurn").mockResolvedValue(),
      spyOn(engine, "run").mockResolvedValue("done reply"),
    );

    const out = await runSimpleTurn(deps, {
      conversationId: "cron-sid",
      prompt: "cron prompt",
      model: "m1",
    });

    expect(out).toBe("done reply");
    expect(deps.conversation.beginTurn).toHaveBeenCalledWith("cron-sid", "cron prompt");
    expect(engine.run).toHaveBeenCalled();
    expect(deps.conversation.finishTurn).toHaveBeenCalledWith(
      "cron-sid",
      msgs,
      "cron prompt",
      "m1",
      ["tool_a"],
      true,
    );
  });

  it("runSimpleTurn catches MaxTurnsExceeded", async () => {
    const deps = wireTestDeps();
    restores.push(
      spyOn(deps.conversation, "beginTurn").mockResolvedValue([
        [{ role: "user" as const, content: "x" }],
        [],
        "x",
      ]),
      spyOn(deps.conversation, "loadConversationTools").mockResolvedValue([]),
      spyOn(deps.conversation, "loadConversationMeta").mockResolvedValue({
        role: "conversation_meta",
        model: "m",
        cached_toolsets: [],
        functions: [],
        timestamp: "",
      }),
      spyOn(engine, "run").mockRejectedValue(new engine.MaxTurnsExceeded()),
    );

    const out = await runSimpleTurn(deps, {
      conversationId: "sid-max",
      prompt: "x",
      model: "m",
    });
    expect(out).toContain("tool loop limit exceeded");
  });
});
