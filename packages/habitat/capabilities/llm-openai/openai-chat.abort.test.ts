import { afterAll, describe, expect, it, mock } from "bun:test";

import type { ChatRequest } from "@freeanima/habitat/core/provider";

let capturedSignal: AbortSignal | undefined;

const clientOriginal = await import("./client.ts");

mock.module("./client.ts", () => ({
  ...clientOriginal,
  createOpenAiClient: () => ({
    chat: {
      completions: {
        create: async (_params: unknown, opts?: { signal?: AbortSignal }) => {
          capturedSignal = opts?.signal;
          if (!opts?.signal) {
            throw new Error("expected signal");
          }
          await new Promise<never>((_resolve, reject) => {
            const onAbort = () => {
              reject(opts.signal!.reason ?? new DOMException("Aborted", "AbortError"));
            };
            if (opts.signal!.aborted) {
              onAbort();
              return;
            }
            opts.signal!.addEventListener("abort", onAbort, { once: true });
          });
        },
      },
    },
  }),
}));

afterAll(() => {
  mock.module("./client.ts", () => clientOriginal);
});

const { runOpenAiChatStream } = await import("./openai-chat.ts");

describe("runOpenAiChatStream external abort", () => {
  it("passes merged signal to completions.create; external abort cancels", async () => {
    capturedSignal = undefined;
    const external = new AbortController();
    const request: ChatRequest = {
      messages: [{ role: "user", content: "hi" }],
      params: {},
      signal: external.signal,
    };
    const pending = (async () => {
      for await (const _ of runOpenAiChatStream("gpt-test", request, {
        baseUrl: "https://example.test/v1",
        apiKey: "k",
        timeoutMs: 60_000,
        firstByteTimeoutMs: 60_000,
      })) {
        /* drain */
      }
    })();
    await Bun.sleep(10);
    expect(capturedSignal).toBeDefined();
    expect(capturedSignal!.aborted).toBe(false);
    external.abort(new Error("wall-clock"));
    await expect(pending).rejects.toBeTruthy();
    expect(capturedSignal!.aborted).toBe(true);
  });
});
