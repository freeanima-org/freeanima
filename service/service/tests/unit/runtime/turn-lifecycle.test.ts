import { describe, it, expect, spyOn, afterEach } from "bun:test";
import * as conv from "@freeanima/engine-conversation";
import * as engine from "@freeanima/engine-loop";
import {
  createTurnMessageCallbacks,
  finalizeTurn,
  runSimpleTurn,
} from "../../../src/runtime/turn-lifecycle.ts";

describe("turn-lifecycle", () => {
  const restores: Array<{ mockRestore: () => void }> = [];

  afterEach(() => {
    for (const spy of restores) spy.mockRestore();
    restores.length = 0;
  });

  it("createTurnMessageCallbacks 写入 appendMessage", async () => {
    const append = spyOn(conv, "appendMessage").mockResolvedValue(undefined);
    restores.push(append);

    const cb = createTurnMessageCallbacks("sid-1");
    await cb.onMessageAppended({ role: "assistant", content: "hi" });
    await cb.onToolRoundComplete([{ role: "tool", tool_call_id: "1", name: "t", content: "{}" }]);

    expect(append).toHaveBeenCalledTimes(2);
    expect(append).toHaveBeenNthCalledWith(1, { role: "assistant", content: "hi" }, "sid-1");
  });

  it("finalizeTurn 以 skipMessageAppend 调用 finishTurn", async () => {
    const finish = spyOn(conv, "finishTurn").mockResolvedValue(undefined);
    restores.push(finish);

    const msgs = [{ role: "user" as const, content: "q" }];
    await finalizeTurn("sid-2", msgs, "q", "model-x", ["fn"]);

    expect(finish).toHaveBeenCalledWith("sid-2", msgs, "q", "model-x", ["fn"], true);
  });

  it("runSimpleTurn 走 beginTurn → run → finishTurn", async () => {
    const msgs = [{ role: "user" as const, content: "cron prompt" }];
    restores.push(
      spyOn(conv, "beginTurn").mockResolvedValue([msgs, ["tool_a"], "cron prompt"]),
      spyOn(conv, "appendMessage").mockResolvedValue(undefined),
      spyOn(conv, "finishTurn").mockResolvedValue(undefined),
      spyOn(engine, "run").mockResolvedValue("done reply"),
    );

    const out = await runSimpleTurn({
      sessionId: "cron-sid",
      prompt: "cron prompt",
      model: "m1",
    });

    expect(out).toBe("done reply");
    expect(conv.beginTurn).toHaveBeenCalledWith("cron-sid", "cron prompt");
    expect(engine.run).toHaveBeenCalled();
    expect(conv.finishTurn).toHaveBeenCalledWith(
      "cron-sid",
      msgs,
      "cron prompt",
      "m1",
      ["tool_a"],
      true,
    );
  });

  it("runSimpleTurn 捕获 MaxTurnsExceeded", async () => {
    restores.push(
      spyOn(conv, "beginTurn").mockResolvedValue([
        [{ role: "user" as const, content: "x" }],
        [],
        "x",
      ]),
      spyOn(conv, "finishTurn").mockResolvedValue(undefined),
      spyOn(engine, "run").mockRejectedValue(new engine.MaxTurnsExceeded("max 8")),
    );

    const out = await runSimpleTurn({ sessionId: "s", prompt: "x", model: "m" });
    expect(out).toBe("[工具循环超限] max 8");
  });
});
