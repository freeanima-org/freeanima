import { beforeEach, describe, expect, mock, test } from "bun:test";

mock.module("@paraglide/messages", () => ({ m: {} }));
mock.module("@paraglide/runtime", () => ({
  getLocale: () => "zh-cn",
  locales: ["zh-cn", "en"],
  setLocale: async (_locale: string) => {},
}));

mock.module("@freeanima/features/chat/ui/spa/lib/api.ts", () => ({
  subscribeMessageStream: (
    _input: unknown,
    callbacks: { onComplete?: () => void; onStreamId?: (id: string) => void },
  ) => {
    queueMicrotask(() => callbacks.onStreamId?.("stream-test"));
    return {
      unsubscribe: () => {
        callbacks.onComplete?.();
      },
    };
  },
  resumeMessageStream: () => ({ unsubscribe: () => {} }),
  interruptMessageStream: async () => {},
  lookupActiveStream: async () => ({}),
}));

mock.module("@freeanima/features/chat/ui/spa/lib/active-stream-persist.ts", () => ({
  writePersistedActiveStream: () => {},
  clearPersistedActiveStream: () => {},
  readPersistedActiveStream: () => null,
}));

mock.module("@freeanima/shared/habitat-rpc", () => ({
  subscribeHabitatRpcConnectionState: () => () => {},
}));

import { useChatStore } from "./chat.ts";

describe("useChatStore queue", () => {
  beforeEach(() => {
    useChatStore.setState({
      queue: [],
      streaming: false,
      recovering: false,
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

  test("abortStream 使进行中的 send() Promise settle（避免刷新后发送锁死）", async () => {
    const sendPromise = useChatStore.getState().send("conv-1", "hi", {
      recoverDisplay: async () => false,
    });
    // 等到订阅挂上
    await Promise.resolve();
    await Promise.resolve();
    expect(useChatStore.getState().streaming).toBe(true);

    useChatStore.getState().abortStream();
    expect(useChatStore.getState().streaming).toBe(false);

    await Promise.race([
      sendPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("send() hung after abortStream")), 500);
      }),
    ]);
  });
});
