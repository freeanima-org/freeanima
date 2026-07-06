import { describe, expect, it, spyOn, afterEach } from "bun:test";
import * as engine from "./loop-engine.ts";
import type { StreamEvent } from "./loop-engine.ts";
import type { StoredMessage } from "@freeanima/core/db/domain";

describe("engine.run", () => {
  let streamSpy: ReturnType<typeof spyOn<typeof engine, "runStream">> | null = null;

  afterEach(() => {
    streamSpy?.mockRestore();
    streamSpy = null;
  });

  it("concatenates tokens and returns after done", async () => {
    streamSpy = spyOn(engine, "runStream").mockImplementation(async function* () {
      const events: StreamEvent[] = [
        { event: "token", data: { content: "hello " } },
        { event: "token", data: { content: "world" } },
        { event: "done", data: {} },
      ];
      for (const ev of events) yield ev;
    });
    const msgs: StoredMessage[] = [{ role: "user", content: "hi", pos: 1 }];
    await expect(engine.run(msgs)).resolves.toBe("hello world");
  });

  it("content_replace overwrites prior tokens", async () => {
    streamSpy = spyOn(engine, "runStream").mockImplementation(async function* () {
      const events: StreamEvent[] = [
        { event: "token", data: { content: "draft" } },
        { event: "content_replace", data: { content: "final" } },
        { event: "done", data: {} },
      ];
      for (const ev of events) yield ev;
    });
    await expect(engine.run([])).resolves.toBe("final");
  });

  it("maps Tool loop exceeded to MaxTurnsExceeded", async () => {
    streamSpy = spyOn(engine, "runStream").mockImplementation(async function* () {
      yield { event: "error", data: { error: "Tool loop exceeded max turns" } };
    });
    await expect(engine.run([])).rejects.toBeInstanceOf(engine.MaxTurnsExceeded);
  });
});
