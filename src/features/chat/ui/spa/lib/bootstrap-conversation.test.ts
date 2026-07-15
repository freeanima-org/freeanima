import { afterEach, describe, expect, mock, test } from "bun:test";

import {
  decideBootstrapConversation,
  pickConversationId,
  resetBootstrapConversationInFlightForTest,
  runBootstrapConversation,
} from "./bootstrap-conversation.ts";

afterEach(() => {
  resetBootstrapConversationInFlightForTest();
});

describe("pickConversationId", () => {
  test("returns first candidate present in list", () => {
    const list = [{ id: "a" }, { id: "b" }];
    expect(pickConversationId(list, ["missing", "b", "a"])).toBe("b");
  });

  test("returns undefined when none match", () => {
    expect(pickConversationId([{ id: "a" }], ["x", null])).toBeUndefined();
  });
});

describe("decideBootstrapConversation", () => {
  test("prefers candidate over first list item", () => {
    expect(decideBootstrapConversation([{ id: "a" }, { id: "b" }], ["b"])).toEqual({
      kind: "select",
      conversationId: "b",
    });
  });

  test("falls back to first list item", () => {
    expect(decideBootstrapConversation([{ id: "a" }, { id: "b" }], [])).toEqual({
      kind: "select",
      conversationId: "a",
    });
  });

  test("requests create when list empty", () => {
    expect(decideBootstrapConversation([], [])).toEqual({ kind: "create" });
  });
});

describe("runBootstrapConversation", () => {
  test("selects without create when first list is non-empty", async () => {
    const createConversation = mock(() => Promise.resolve("new"));
    const selectConversation = mock(() => Promise.resolve());
    const result = await runBootstrapConversation({
      fetchConversations: async () => [{ id: "existing" }],
      whenReady: async () => {},
      createConversation,
      selectConversation,
      candidates: ["existing"],
    });
    expect(result).toBe("selected");
    expect(selectConversation).toHaveBeenCalledWith("existing");
    expect(createConversation).not.toHaveBeenCalled();
  });

  test("re-lists after whenReady before create (avoids false empty)", async () => {
    let fetches = 0;
    const createConversation = mock(() => Promise.resolve("new"));
    const selectConversation = mock(() => Promise.resolve());
    const result = await runBootstrapConversation({
      fetchConversations: async () => {
        fetches += 1;
        return fetches === 1 ? [] : [{ id: "from-hub" }];
      },
      whenReady: async () => {},
      createConversation,
      selectConversation,
      candidates: [],
    });
    expect(result).toBe("selected");
    expect(fetches).toBe(2);
    expect(selectConversation).toHaveBeenCalledWith("from-hub");
    expect(createConversation).not.toHaveBeenCalled();
  });

  test("creates only when still empty after whenReady", async () => {
    const createConversation = mock(() => Promise.resolve("new-id"));
    const selectConversation = mock(() => Promise.resolve());
    const result = await runBootstrapConversation({
      fetchConversations: async () => [],
      whenReady: async () => {},
      createConversation,
      selectConversation,
      candidates: [],
    });
    expect(result).toBe("created");
    expect(createConversation).toHaveBeenCalledTimes(1);
    expect(selectConversation).not.toHaveBeenCalled();
  });

  test("coalesces concurrent bootstraps into one create", async () => {
    let fetches = 0;
    const createConversation = mock(async () => {
      await Promise.resolve();
      return "only-one";
    });
    const selectConversation = mock(() => Promise.resolve());
    const deps = {
      fetchConversations: async () => {
        fetches += 1;
        return [];
      },
      whenReady: async () => {},
      createConversation,
      selectConversation,
      candidates: [] as (string | null | undefined)[],
    };
    const [a, b] = await Promise.all([
      runBootstrapConversation(deps),
      runBootstrapConversation(deps),
    ]);
    expect(a).toBe("created");
    expect(b).toBe("created");
    expect(createConversation).toHaveBeenCalledTimes(1);
    // 同一次 in-flight：两次 fetch（ready 前 + ready 后），不是四次
    expect(fetches).toBe(2);
  });

  test("stays empty when whenReady fails", async () => {
    const createConversation = mock(() => Promise.resolve("new"));
    const result = await runBootstrapConversation({
      fetchConversations: async () => [],
      whenReady: async () => {
        throw new Error("offline");
      },
      createConversation,
      selectConversation: async () => {},
      candidates: [],
    });
    expect(result).toBe("empty");
    expect(createConversation).not.toHaveBeenCalled();
  });
});
