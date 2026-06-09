import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/engine-conversation";
import * as engine from "@freeanima/engine-loop";
import type { StreamEvent } from "@freeanima/engine-loop";
import { createConversationService } from "@freeanima/engine-conversation";
import { nullPgRepositories } from "@freeanima/engine-repos";
import { MaskRegistry } from "@freeanima/capabilities-mask";
import { createEngineCatalog, type Engine } from "@freeanima/engine";
import { createServiceKernel } from "@freeanima/service-bootstrap";
import { getAcpManager } from "@freeanima/capabilities-acp";
import { AnimaService } from "./anima-service.ts";
import { initServiceContext } from "../context.ts";

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

describe("sendMessageStream done 顺序", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("done 在 finishTurn 开始之前 yield 给消费者", async () => {
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
