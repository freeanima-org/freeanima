import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

mock.module("@paraglide/messages", () => ({ m: {} }));
mock.module("@paraglide/runtime", () => ({
  getLocale: () => "zh-cn",
  locales: ["zh-cn", "en"],
  setLocale: async (_locale: string) => {},
}));

const { buildHeadlessChatStreamFlushContext, chatStreamAdapter } =
  await import("@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts");
const { claimChatSend, resetChatSendClaimsForTests } =
  await import("@freeanima/features/chat/ui/spa/lib/offline-send-store.ts");
import type { OfflineOutboxOp } from "@freeanima/frontend/portal-sdk/offline-outbox.ts";

describe("buildHeadlessChatStreamFlushContext", () => {
  it("提供不依赖 ChatApp 的 stream flush context", () => {
    const ctx = buildHeadlessChatStreamFlushContext();
    expect(ctx.scope).toBeTruthy();
    expect(typeof ctx.stream.onEvent).toBe("function");
    expect(typeof ctx.stream.onDone).toBe("function");
    expect(typeof ctx.stream.onError).toBe("function");
    expect(ctx.forceTail).toBeUndefined();
  });

  it("支持 forceTail", () => {
    const ctx = buildHeadlessChatStreamFlushContext(true);
    expect(ctx.forceTail).toBe(true);
  });
});

describe("chatStreamAdapter.preflight claim", () => {
  afterEach(() => {
    resetChatSendClaimsForTests();
  });

  const op: OfflineOutboxOp = {
    id: "op-claim-1",
    moduleId: "chat",
    method: "message.send",
    createdAt: "2026-01-01T00:00:00.000Z",
    payload: {
      conversation_id: "c1",
      message: "hi",
      client_op_id: "op-claim-1",
      expected_tail_pos: 0,
    },
  };

  it("已 claim 时 abort，即使 forceTail 也不 proceed", async () => {
    claimChatSend("op-claim-1");
    const ctx = buildHeadlessChatStreamFlushContext(true);
    expect(chatStreamAdapter.preflight).toBeDefined();
    const result = await chatStreamAdapter.preflight!(op, ctx);
    expect(result).toBe("abort");
  });

  it("未 claim 且 forceTail 时 proceed", async () => {
    const ctx = buildHeadlessChatStreamFlushContext(true);
    const result = await chatStreamAdapter.preflight!(op, ctx);
    expect(result).toBe("proceed");
  });

  it("未 claim 时按 tail 判定 stale", async () => {
    const api = await import("./api.ts");
    const spy = spyOn(api, "getConversationTail").mockResolvedValue({
      tail_pos: 3,
    } as never);
    try {
      const ctx = buildHeadlessChatStreamFlushContext(false);
      const result = await chatStreamAdapter.preflight!(op, ctx);
      expect(result).toBe("stale");
      expect(spy).toHaveBeenCalled();
    } finally {
      spy.mockRestore();
    }
  });
});
