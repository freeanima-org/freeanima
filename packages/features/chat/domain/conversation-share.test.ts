import { describe, expect, test } from "bun:test";

import { buildConversationSharePublicUrl, conversationShareUrlPath } from "./conversation-share.ts";

describe("conversation share public url", () => {
  test("url_path 为壳相对路径", () => {
    expect(conversationShareUrlPath("abc")).toBe("/share/abc");
  });

  test("绝对 url 使用 /web 前缀", () => {
    expect(buildConversationSharePublicUrl("abc", "https://anima.example.com")).toBe(
      "https://anima.example.com/web/share/abc",
    );
    expect(buildConversationSharePublicUrl("abc", "https://anima.example.com/")).toBe(
      "https://anima.example.com/web/share/abc",
    );
  });
});
