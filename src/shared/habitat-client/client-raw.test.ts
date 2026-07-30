import { describe, expect, test } from "bun:test";

import { createHabitatClient } from "./client.ts";

describe("createHabitatClient callRaw", () => {
  test("callRaw returns Response for tls.ca", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("pem-bytes", {
        status: 200,
        headers: { "Content-Type": "application/x-pem-file" },
      })) as unknown as typeof fetch;
    try {
      const client = createHabitatClient({
        httpOrigin: "http://127.0.0.1:2658",
        getRpcClient: async () => {
          throw new Error("ws not used");
        },
      });
      const res = await client.callRaw("tls.ca", {});
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("pem-bytes");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("call rejects raw response method on HTTP", async () => {
    const client = createHabitatClient({
      httpOrigin: "http://127.0.0.1:2658",
      getRpcClient: async () => {
        throw new Error("ws not used");
      },
    });
    await expect(client.call("tls.ca", {})).rejects.toThrow(/callRaw/);
  });

  test("callRaw applies timeoutMs via AbortSignal", async () => {
    const originalFetch = globalThis.fetch;
    let seenSignal: AbortSignal | undefined;
    globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      seenSignal = init?.signal ?? undefined;
      return new Response("ok", {
        status: 200,
        headers: { "Content-Type": "application/x-pem-file" },
      });
    }) as unknown as typeof fetch;
    try {
      const client = createHabitatClient({
        httpOrigin: "http://127.0.0.1:2658",
        getRpcClient: async () => {
          throw new Error("ws not used");
        },
      });
      const res = await client.callRaw("tls.ca", {}, { timeoutMs: 60_000 });
      expect(res.status).toBe(200);
      expect(seenSignal).toBeDefined();
      expect(seenSignal?.aborted).toBe(false);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("callRaw prefers opts.signal over meta timeout", async () => {
    const originalFetch = globalThis.fetch;
    const controller = new AbortController();
    let seenSignal: AbortSignal | undefined;
    globalThis.fetch = (async (_input: URL | RequestInfo, init?: RequestInit) => {
      seenSignal = init?.signal ?? undefined;
      return new Response("ok", { status: 200 });
    }) as unknown as typeof fetch;
    try {
      const client = createHabitatClient({
        httpOrigin: "http://127.0.0.1:2658",
        getRpcClient: async () => {
          throw new Error("ws not used");
        },
      });
      await client.callRaw("tls.ca", {}, { signal: controller.signal });
      expect(seenSignal).toBe(controller.signal);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
