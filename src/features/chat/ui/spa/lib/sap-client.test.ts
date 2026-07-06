import { describe, expect, test, afterEach } from "bun:test";

import {
  chatPlatform,
  loadChatInstanceId,
  resetChatInstanceCacheForTests,
  subscribeShellConfigChanges,
} from "./sap-client.ts";

describe("chat platform", () => {
  test("loadChatInstanceId 返回 chat", () => {
    resetChatInstanceCacheForTests();
    expect(loadChatInstanceId()).toBe("chat");
  });

  test("chatPlatform 返回 chat", () => {
    resetChatInstanceCacheForTests();
    expect(chatPlatform()).toBe("chat");
  });
});

describe("subscribeShellConfigChanges", () => {
  afterEach(() => {
    resetChatInstanceCacheForTests();
  });

  test("导出订阅函数", () => {
    const prevWindow = globalThis.window;
    const handlers = new Map<string, EventListener>();
    globalThis.window = {
      addEventListener(type: string, handler: EventListener) {
        handlers.set(type, handler);
      },
      removeEventListener(type: string) {
        handlers.delete(type);
      },
    } as Window & typeof globalThis;
    try {
      expect(typeof subscribeShellConfigChanges).toBe("function");
      const unsub = subscribeShellConfigChanges();
      expect(typeof unsub).toBe("function");
      unsub();
    } finally {
      globalThis.window = prevWindow;
    }
  });
});
