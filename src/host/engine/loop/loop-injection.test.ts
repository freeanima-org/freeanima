import { describe, expect, it, mock, spyOn, afterEach } from "bun:test";
import type { StoredMessage } from "@freeanima/host/core/db/domain";
import { ToolSetRegistry } from "@freeanima/host/core/tool";
import * as llm from "@freeanima/host/core/llm";
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
});
