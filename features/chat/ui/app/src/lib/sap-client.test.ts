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
    expect(typeof subscribeShellConfigChanges).toBe("function");
    const unsub = subscribeShellConfigChanges();
    expect(typeof unsub).toBe("function");
    unsub();
  });
});
