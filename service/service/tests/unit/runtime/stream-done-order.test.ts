import { describe, it, expect, spyOn, afterEach, beforeEach } from "bun:test";
import * as conv from "@freeanima/engine-conversation";
import * as engine from "@freeanima/engine-loop";
import type { StreamEvent } from "@freeanima/engine-loop";
import { AnimaService } from "../../../src/runtime/anima-service.ts";
import {
  beginMinimalConfigHome,
  endMinimalConfigHome,
} from "../../../../../tests/helpers/minimal-config-home.ts";

describe("sendMessageStream done 顺序", () => {
  const restores: Array<{ mockRestore: () => void }> = [];
  let prevHome: string | undefined;

  beforeEach(() => {
    ({ prevHome } = beginMinimalConfigHome("anima-stream-done-"));
  });

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
    endMinimalConfigHome(prevHome);
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

    const svc = new AnimaService();
    for await (const ev of svc.sendMessageStream("test-sid", "hello", "parlor")) {
      if (ev.event === "done") {
        doneSeenBeforeFinishTurn = !finishTurnStarted;
      }
    }

    expect(doneSeenBeforeFinishTurn).toBe(true);
    expect(finishTurnStarted).toBe(true);
  });
});
