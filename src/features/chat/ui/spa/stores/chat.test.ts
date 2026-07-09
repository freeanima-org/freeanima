import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@paraglide/messages", () => ({ m: {} }));
mock.module("@paraglide/runtime", () => ({
  getLocale: () => "zh-cn",
  locales: ["zh-cn", "en"],
  setLocale: async (_locale: string) => {},
}));

import { useChatStore } from "./chat.ts";

describe("useChatStore queue", () => {
  beforeEach(() => {
    useChatStore.setState({
      queue: [],
      streaming: false,
      streamingConversationId: null,
      streamText: "",
    });
  });

  test("enqueue 与 peekQueue 按 conversation 隔离", () => {
    useChatStore.getState().enqueue("s1", "hello");
    useChatStore.getState().enqueue("s2", "world");
    expect(useChatStore.getState().peekQueue("s1")?.text).toBe("hello");
    expect(useChatStore.getState().peekQueue("s2")?.text).toBe("world");
  });

  test("takeQueued 移除指定项", () => {
    useChatStore.getState().enqueue("s1", "a");
    useChatStore.getState().enqueue("s1", "b");
    const first = useChatStore.getState().peekQueue("s1")!;
    const taken = useChatStore.getState().takeQueued(first.id);
    expect(taken?.text).toBe("a");
    expect(useChatStore.getState().peekQueue("s1")?.text).toBe("b");
  });
});
