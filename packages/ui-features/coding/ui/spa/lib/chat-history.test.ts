import { describe, expect, test } from "bun:test";

import { fetchCodingConversationHistory, fetchCodingOlderMessages } from "./chat-history.ts";

// fetchCodingConversationHistory 依赖 Habitat；normalize 逻辑经 chat-thread 覆盖。
// 此处仅保证模块可导入（无 mock 时跳过 RPC）。
describe("chat-history", () => {
  test("export fetchCodingConversationHistory", () => {
    expect(typeof fetchCodingConversationHistory).toBe("function");
  });
  test("export fetchCodingOlderMessages", () => {
    expect(typeof fetchCodingOlderMessages).toBe("function");
  });
});
