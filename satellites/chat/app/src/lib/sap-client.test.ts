import { describe, expect, test, afterEach } from "bun:test";

import { CHAT_INSTANCE_ID, formatSapPlatform } from "@freeanima/sap-contract";

import {
  chatPlatform,
  loadChatInstanceId,
  resetChatInstanceCacheForTests,
  subscribeShellConfigChanges,
} from "./sap-client.ts";

describe("chat singleton instance_id", () => {
  test("loadChatInstanceId 返回固定 CHAT_INSTANCE_ID", () => {
    resetChatInstanceCacheForTests();
    expect(loadChatInstanceId()).toBe(CHAT_INSTANCE_ID);
  });

  test("chatPlatform 返回 sap:chat:def", () => {
    resetChatInstanceCacheForTests();
    expect(chatPlatform()).toBe(formatSapPlatform("chat", CHAT_INSTANCE_ID));
    expect(chatPlatform()).toBe("sap:chat:def");
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
