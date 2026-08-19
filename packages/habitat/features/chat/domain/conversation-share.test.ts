import { describe, expect, it } from "bun:test";

import {
  CONVERSATION_SHARE_TTL,
  conversationShareIdFromKey,
  conversationShareKey,
  filterDisplayByPosList,
  ttlSecondsFor,
} from "./conversation-share.ts";
import type { DisplayItem } from "@freeanima/shared/rpc-contract/frames/display";

describe("conversation-share domain", () => {
  it("maps ttl enums to seconds", () => {
    expect(ttlSecondsFor("1h")).toBe(CONVERSATION_SHARE_TTL["1h"]);
    expect(ttlSecondsFor("1d")).toBe(24 * 60 * 60);
    expect(ttlSecondsFor("1w")).toBe(7 * 24 * 60 * 60);
    expect(ttlSecondsFor("1mo")).toBe(30 * 24 * 60 * 60);
  });

  it("extracts share id from redis key", () => {
    const id = "abc123";
    expect(conversationShareIdFromKey(conversationShareKey(id))).toBe(id);
    expect(conversationShareIdFromKey("anima:kv:other:x")).toBeNull();
    expect(conversationShareIdFromKey(conversationShareKey(""))).toBeNull();
  });

  it("filters selected message pos and drops tool_block", () => {
    const display: DisplayItem[] = [
      { type: "message", role: "user", content: "a", pos: 1 },
      {
        type: "tool_block",
        calls: [
          {
            name: "web_search",
            argsPreview: "",
            tool_call_id: "c1",
            status: "done",
          },
        ],
      },
      { type: "message", role: "assistant", content: "b", pos: 3 },
      { type: "message", role: "user", content: "c", pos: 5 },
    ];
    const filtered = filterDisplayByPosList(display, [1, 5]);
    expect(filtered).toEqual([
      { type: "message", role: "user", content: "a", pos: 1 },
      { type: "message", role: "user", content: "c", pos: 5 },
    ]);
  });

  it("returns empty when pos_list misses all messages", () => {
    const display: DisplayItem[] = [
      { type: "message", role: "user", content: "a", pos: 1 },
      { type: "message", role: "assistant", content: "b" },
    ];
    expect(filterDisplayByPosList(display, [99])).toEqual([]);
  });
});
