import { describe, expect, it } from "bun:test";

import { buildHeadlessChatStreamFlushContext } from "@freeanima/features/chat/ui/spa/lib/offline-stream-adapter.ts";

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
