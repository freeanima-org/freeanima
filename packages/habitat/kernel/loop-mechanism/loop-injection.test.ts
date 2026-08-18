import { describe, expect, it, mock, spyOn, afterEach } from "bun:test";
import type { StoredMessage } from "@freeanima/habitat/core/db/domain";
import { ToolSetRegistry } from "@freeanima/habitat/core/tool";
import * as llm from "@freeanima/habitat/core/llm";
import { runStream, type AfterMessagesPersisted } from "./loop-engine.ts";

describe("loop onAfterMessagesPersisted injection", () => {
  let chatSpy: ReturnType<typeof spyOn<typeof llm, "chatStream">> | null = null;

  afterEach(() => {
    chatSpy?.mockRestore();
    chatSpy = null;
  });

  function stubChatStream(): void {
    chatSpy = spyOn(llm, "chatStream").mockImplementation(async function* () {
      yield { type: "content" as const, content: "ok" };
      yield {
        type: "done" as const,
        reasoning: null,
        usage: null,
        finish_reason: "stop",
      };
    });
  }

  it("does not require session PG when hook omitted", async () => {
    stubChatStream();
    const registry = new ToolSetRegistry();
    const msgs: StoredMessage[] = [{ role: "user", content: "hi" }];
    const events: string[] = [];
    for await (const ev of runStream(msgs, {
      model: "test-model",
      tools: [],
      toolRegistry: registry,
    })) {
      events.push(ev.event);
    }
    expect(events).toContain("done");
    expect(chatSpy).toHaveBeenCalled();
  });

  it("invokes onAfterMessagesPersisted after assistant persist", async () => {
    stubChatStream();
    const registry = new ToolSetRegistry();
    const after: AfterMessagesPersisted = mock(async () => {});
    const msgs: StoredMessage[] = [{ role: "user", content: "hi" }];
    for await (const _ of runStream(msgs, {
      model: "test-model",
      tools: [],
      toolRegistry: registry,
      onAfterMessagesPersisted: after,
    })) {
      // drain
    }
    expect(after).toHaveBeenCalled();
    const arg = (after as ReturnType<typeof mock>).mock.calls[0]?.[0] as {
      batch: StoredMessage[];
      model: string;
    };
    expect(arg.model).toBe("test-model");
    expect(arg.batch[0]?.role).toBe("assistant");
  });

  it("abort during chatStream yields interrupted and does not persist", async () => {
    const ac = new AbortController();
    chatSpy = spyOn(llm, "chatStream").mockImplementation(async function* () {
      yield { type: "content" as const, content: "hel" };
      ac.abort();
      yield { type: "content" as const, content: "lo" };
      yield { type: "done" as const, finish_reason: "stop" };
    });
    const persisted: StoredMessage[] = [];
    const events: string[] = [];
    for await (const ev of runStream([{ role: "user", content: "hi" }], {
      model: "test-model",
      tools: [],
      toolRegistry: new ToolSetRegistry(),
      signal: ac.signal,
      onMessageAppended: (m) => {
        persisted.push(m);
      },
    })) {
      events.push(ev.event);
    }
    expect(events).toContain("token");
    expect(events).toContain("interrupted");
    expect(events.at(-1)).toBe("done");
    expect(persisted).toEqual([]);
  });
});
