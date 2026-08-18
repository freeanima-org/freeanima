import { afterAll, afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

type StreamCallbacks = {
  onData?: (ev: { event: string; data: Record<string, unknown> }) => void;
  onComplete?: () => void;
  onError?: (err: Error) => void;
  onStreamId?: (id: string) => void;
};

/** idle：仅挂订阅；error_then_done：模拟 bridge 先 error 再 done */
let streamScenario: "idle" | "error_then_done" = "idle";
let interruptHang: Promise<void> | null = null;

const apiOriginal = await import("@freeanima/features/chat/ui/spa/lib/api.ts");
const habitatRpcOriginal = await import("@freeanima/shared/habitat-rpc/bundled-browser.ts");

mock.module("@freeanima/features/chat/ui/spa/lib/api.ts", () => ({
  ...apiOriginal,
  subscribeMessageStream: (_input: unknown, callbacks: StreamCallbacks) => {
    queueMicrotask(() => {
      callbacks.onStreamId?.("stream-test");
      if (streamScenario === "error_then_done") {
        callbacks.onData?.({
          event: "error",
          data: { error: "LLM call failed: 403 China opt-in required" },
        });
        callbacks.onData?.({ event: "done", data: {} });
        callbacks.onComplete?.();
      }
    });
    return {
      unsubscribe: () => {
        callbacks.onComplete?.();
      },
    };
  },
  resumeMessageStream: (_streamId: string, callbacks: StreamCallbacks) => {
    queueMicrotask(() => {
      callbacks.onStreamId?.("stream-resume");
      if (streamScenario === "error_then_done") {
        callbacks.onData?.({
          event: "error",
          data: { error: "LLM call failed: 403 China opt-in required" },
        });
        callbacks.onData?.({ event: "done", data: {} });
        callbacks.onComplete?.();
      }
    });
    return {
      unsubscribe: () => {
        callbacks.onComplete?.();
      },
    };
  },
  subscribeContinueStream: (_input: unknown, callbacks: StreamCallbacks) => {
    queueMicrotask(() => {
      callbacks.onStreamId?.("stream-continue");
      callbacks.onData?.({ event: "token", data: { content: "续" } });
      callbacks.onData?.({ event: "done", data: {} });
      callbacks.onComplete?.();
    });
    return {
      unsubscribe: () => {
        callbacks.onComplete?.();
      },
    };
  },
  interruptMessageStream: async () => {
    if (interruptHang) await interruptHang;
  },
  lookupActiveStream: async () =>
    streamScenario === "error_then_done" ? { stream_id: "stream-resume", status: "active" } : {},
}));

mock.module("@freeanima/shared/habitat-rpc/bundled-browser.ts", () => ({
  ...habitatRpcOriginal,
  subscribeHabitatRpcConnectionState: () => () => {},
}));

afterAll(() => {
  mock.module("@freeanima/features/chat/ui/spa/lib/api.ts", () => apiOriginal);
  mock.module("@freeanima/shared/habitat-rpc/bundled-browser.ts", () => habitatRpcOriginal);
});

const { useChatStore } = await import("./chat.ts");

const sessionStore = new Map<string, string>();

describe("useChatStore queue", () => {
  beforeEach(() => {
    streamScenario = "idle";
    interruptHang = null;
    sessionStore.clear();
    Object.defineProperty(globalThis, "sessionStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => sessionStore.get(key) ?? null,
        setItem: (key: string, value: string) => {
          sessionStore.set(key, value);
        },
        removeItem: (key: string) => {
          sessionStore.delete(key);
        },
      },
    });
    useChatStore.setState({
      queue: [],
      streaming: false,
      recovering: false,
      recoveringConversationId: null,
      streamingConversationId: null,
      userStoppedIds: [],
      streamText: "",
    });
  });

  afterEach(() => {
    sessionStore.clear();
    streamScenario = "idle";
    interruptHang = null;
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

  test("stream.error 后再 stream.done 应调 onError、不调 onDone", async () => {
    streamScenario = "error_then_done";
    const errors: string[] = [];
    let onDoneCalled = false;

    await useChatStore.getState().send("conv-1", "hi", {
      recoverDisplay: async () => false,
      onError: (msg) => {
        errors.push(msg);
      },
      onDone: () => {
        onDoneCalled = true;
      },
    });

    expect(errors).toEqual(["LLM call failed: 403 China opt-in required"]);
    expect(onDoneCalled).toBe(false);
    expect(useChatStore.getState().streaming).toBe(false);
  });

  test("resumeIfActive：error 后再 done 应调 onError、不调 onDone", async () => {
    streamScenario = "error_then_done";
    const errors: string[] = [];
    let onDoneCalled = false;

    const resumed = await useChatStore.getState().resumeIfActive("conv-1", {
      recoverDisplay: async () => false,
      onError: (msg) => {
        errors.push(msg);
      },
      onDone: () => {
        onDoneCalled = true;
      },
    });

    expect(resumed).toBe(false);
    expect(errors).toEqual(["LLM call failed: 403 China opt-in required"]);
    expect(onDoneCalled).toBe(false);
    expect(useChatStore.getState().streaming).toBe(false);
  });

  test("continueTurn 成功应调 onDone", async () => {
    streamScenario = "idle";
    let onDoneCalled = false;
    await useChatStore.getState().continueTurn("conv-1", {
      recoverDisplay: async () => false,
      onDone: () => {
        onDoneCalled = true;
      },
    });
    expect(onDoneCalled).toBe(true);
    expect(useChatStore.getState().streaming).toBe(false);
  });

  test("stop() 立即清 streaming，即使 interrupt 挂起", async () => {
    let release = () => {};
    interruptHang = new Promise<void>((resolve) => {
      release = resolve;
    });
    const sendPromise = useChatStore.getState().send("conv-1", "hi", {
      recoverDisplay: async () => false,
    });
    await Promise.resolve();
    await Promise.resolve();
    expect(useChatStore.getState().streaming).toBe(true);

    const stopPromise = useChatStore.getState().stop("conv-1");
    expect(useChatStore.getState().streaming).toBe(false);
    expect(useChatStore.getState().wasUserStopped("conv-1")).toBe(true);

    await Promise.race([
      stopPromise,
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("stop() hung on interrupt")), 200);
      }),
    ]);

    release();
    await sendPromise;
  });

  test("stop() 后 resumeIfActive 拒绝续接", async () => {
    streamScenario = "error_then_done";
    await useChatStore.getState().stop("conv-1");
    const resumed = await useChatStore.getState().resumeIfActive("conv-1", {
      recoverDisplay: async () => false,
    });
    expect(resumed).toBe(false);
    expect(useChatStore.getState().streaming).toBe(false);
  });

  test("send() 后清除 userStopped 并可以再跑", async () => {
    await useChatStore.getState().stop("conv-1");
    expect(useChatStore.getState().wasUserStopped("conv-1")).toBe(true);
    streamScenario = "error_then_done";
    await useChatStore.getState().send("conv-1", "again", {
      recoverDisplay: async () => false,
    });
    expect(useChatStore.getState().wasUserStopped("conv-1")).toBe(false);
    expect(useChatStore.getState().streaming).toBe(false);
  });
});
