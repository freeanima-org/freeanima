import { describe, expect, it } from "bun:test";
import {
  createHookContext,
  emitConversationUpdated,
  onBeforeLlmCall,
  onConversationUpdated,
  onMessageIncoming,
  onSystemPromptBuild,
  onToolAfterCall,
  onTurnAfterComplete,
  runBeforeLlmCall,
  runMessageIncoming,
  runSystemPromptBuild,
  runToolAfterCall,
  runTurnAfterComplete,
} from "./index.ts";
import type { TurnControl } from "../loop/hook-stream.ts";

const EMPTY_PROMPT_CTX = { functionNames: [] as string[], mode: "digital_human" as const };
const LLM_CTX = { conversationId: "c1", messages: [] };

describe("cordis hook host", () => {
  it("runs beforeLlmCall listeners sequentially in registration order", async () => {
    const ctx = createHookContext();
    const order: string[] = [];
    onBeforeLlmCall(ctx, async () => {
      await Promise.resolve();
      order.push("a");
    });
    onBeforeLlmCall(ctx, () => {
      order.push("b");
    });
    await runBeforeLlmCall(ctx, LLM_CTX);
    expect(order).toEqual(["a", "b"]);
  });

  it("contains beforeLlmCall failures without aborting later listeners", async () => {
    const ctx = createHookContext();
    const order: string[] = [];
    onBeforeLlmCall(ctx, () => {
      throw new Error("boom");
    });
    onBeforeLlmCall(ctx, () => {
      order.push("after");
    });
    await runBeforeLlmCall(ctx, LLM_CTX);
    expect(order).toEqual(["after"]);
  });

  it("toolAfterCall last-registered effect wins", async () => {
    const ctx = createHookContext();
    const tcA: TurnControl = { pause: true, streamEvents: [{ event: "done", data: {} }] };
    const tcB: TurnControl = {
      pause: true,
      streamEvents: [{ event: "awaiting_clarify", data: { items: [], timeout_sec: 1 } }],
    };
    onToolAfterCall(ctx, () => ({ turnControl: tcA }));
    onToolAfterCall(ctx, () => ({ turnControl: tcB }));
    const outcome = await runToolAfterCall(ctx, {
      conversationId: "c1",
      toolName: "clarify",
      args: {},
      result: "",
    });
    expect(outcome.turnControl).toBe(tcB);
  });

  it("messageIncoming blocked vetoes downstream listeners", async () => {
    const ctx = createHookContext();
    onMessageIncoming(ctx, () => ({ blocked: "no" }));
    onMessageIncoming(ctx, () => ({ transformedMessage: "later" }));
    const outcome = await runMessageIncoming(ctx, {
      conversationId: "c1",
      message: "m",
      platform: "console",
    });
    expect(outcome.blocked).toBe("no");
    expect(outcome.transformedMessage).toBeUndefined();
  });

  it("messageIncoming transform merge keeps last-registered effect", async () => {
    const ctx = createHookContext();
    onMessageIncoming(ctx, () => ({ transformedMessage: "A" }));
    onMessageIncoming(ctx, () => ({ transformedMessage: "B" }));
    const outcome = await runMessageIncoming(ctx, {
      conversationId: "c1",
      message: "m",
      platform: "console",
    });
    expect(outcome.transformedMessage).toBe("B");
  });

  it("turnAfterComplete surfaces displayContent", async () => {
    const ctx = createHookContext();
    onTurnAfterComplete(ctx, () => ({ displayContent: "shown" }));
    const outcome = await runTurnAfterComplete(ctx, { conversationId: "c1", messages: [] });
    expect(outcome.displayContent).toBe("shown");
  });

  it("systemPromptBuild collects effects oldest-first", async () => {
    const ctx = createHookContext();
    onSystemPromptBuild(ctx, () => ({ sections: [{ id: "a", content: "A", order: 0 }] }));
    onSystemPromptBuild(ctx, () => ({ sections: [{ id: "b", content: "B", order: 1 }] }));
    const effects = await runSystemPromptBuild(ctx, EMPTY_PROMPT_CTX);
    expect(effects.flatMap((e) => e.sections?.map((s) => s.id) ?? [])).toEqual(["a", "b"]);
  });

  it("systemPromptBuild contains a throwing handler and keeps downstream effects", async () => {
    const ctx = createHookContext();
    onSystemPromptBuild(ctx, () => {
      throw new Error("boom");
    });
    onSystemPromptBuild(ctx, () => ({ sections: [{ id: "a", content: "A", order: 0 }] }));
    const effects = await runSystemPromptBuild(ctx, EMPTY_PROMPT_CTX);
    expect(effects.flatMap((e) => e.sections?.map((s) => s.id) ?? [])).toEqual(["a"]);
  });

  it("conversationUpdated emit reaches subscribers", () => {
    const ctx = createHookContext();
    const seen: string[] = [];
    onConversationUpdated(ctx, (payload) => {
      seen.push(payload.conversation_id);
    });
    emitConversationUpdated(ctx, { conversation_id: "c1" });
    expect(seen).toEqual(["c1"]);
  });

  it("returned disposer removes a listener", async () => {
    const ctx = createHookContext();
    const seen: number[] = [];
    const off = onBeforeLlmCall(ctx, () => {
      seen.push(1);
    });
    off();
    await runBeforeLlmCall(ctx, LLM_CTX);
    expect(seen).toEqual([]);
  });
});
