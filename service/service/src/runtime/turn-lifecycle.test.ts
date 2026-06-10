import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/engine-conversation";
import * as engine from "@freeanima/engine-loop";
import { createConversationService } from "@freeanima/engine-conversation";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { createEngineCatalog, type Engine } from "@freeanima/engine";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { AnimaService } from "./anima-service.ts";
import { initServiceContext } from "../context.ts";
import { createTurnMessageCallbacks, finalizeTurn, runSimpleTurn } from "./turn-lifecycle.ts";

const catalog = createEngineCatalog();
const testEngine = { catalog, repos: nullPgRepositories } as Engine;

function wireTestService(): AnimaService {
  const kernel = createServiceKernel();
  const conversation = createConversationService(nullPgRepositories, catalog.toolSets);
  const service = new AnimaService({ kernel, conversation });
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

describe("turn-lifecycle", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("createTurnMessageCallbacks writes appendMessage", async () => {
    const append = spyOn(conv, "appendMessage").mockResolvedValue(undefined);
    restores.push(append);
    wireTestService();

    const cb = createTurnMessageCallbacks("sid-1");
    await cb.onMessageAppended({ role: "assistant", content: "hi" });
    await cb.onToolRoundComplete([{ role: "tool", tool_call_id: "1", name: "t", content: "{}" }]);

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(
      1,
      nullPgRepositories,
      { role: "assistant", content: "hi" },
      "sid-1",
    );
  });

  it("finalizeTurn calls finishTurn with skipMessageAppend", async () => {
    const finish = spyOn(conv, "finishTurn").mockResolvedValue(undefined);
    restores.push(finish);
    wireTestService();

    const msgs = [{ role: "user" as const, content: "q" }];
    await finalizeTurn("sid-2", msgs, "q", "model-x", ["fn"]);

    expect(finish).toHaveBeenCalledWith(
      nullPgRepositories,
      catalog.toolSets,
      "sid-2",
      msgs,
      "q",
      "model-x",
      ["fn"],
      true,
    );
  });

  it("runSimpleTurn goes beginTurn → run → finishTurn", async () => {
    const msgs = [{ role: "user" as const, content: "cron prompt" }];
    restores.push(
      spyOn(conv, "beginTurn").mockResolvedValue([msgs, ["tool_a"], "cron prompt"]),
      spyOn(conv, "appendMessage").mockResolvedValue(undefined),
      spyOn(conv, "finishTurn").mockResolvedValue(undefined),
      spyOn(engine, "run").mockResolvedValue("done reply"),
    );
    wireTestService();

    const out = await runSimpleTurn({
      sessionId: "cron-sid",
      prompt: "cron prompt",
      model: "m1",
    });

    expect(out).toBe("done reply");
    expect(conv.beginTurn).toHaveBeenCalledWith(
      nullPgRepositories,
      catalog.toolSets,
      "cron-sid",
      "cron prompt",
    );
    expect(engine.run).toHaveBeenCalled();
    expect(conv.finishTurn).toHaveBeenCalledWith(
      nullPgRepositories,
      catalog.toolSets,
      "cron-sid",
      msgs,
      "cron prompt",
      "m1",
      ["tool_a"],
      true,
    );
  });

  it("runSimpleTurn catches MaxTurnsExceeded", async () => {
    restores.push(
      spyOn(conv, "beginTurn").mockResolvedValue([
        [{ role: "user" as const, content: "x" }],
        [],
        "x",
      ]),
      spyOn(conv, "finishTurn").mockResolvedValue(undefined),
      spyOn(engine, "run").mockRejectedValue(new engine.MaxTurnsExceeded("max 8")),
    );
    wireTestService();

    const out = await runSimpleTurn({ sessionId: "s", prompt: "x", model: "m" });
    expect(out).toBe("[tool loop limit exceeded] max 8");
  });
});
