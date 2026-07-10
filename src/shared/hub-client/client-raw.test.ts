import { describe, expect, test } from "bun:test";

import { createHubClient } from "./client.ts";

describe("createHubClient callRaw", () => {
  test("callRaw returns Response for tls.ca", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () =>
      new Response("pem-bytes", {
        status: 200,
        headers: { "Content-Type": "application/x-pem-file" },
      })) as unknown as typeof fetch;
    try {
      const client = createHubClient({
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
    const client = createHubClient({
      httpOrigin: "http://127.0.0.1:2658",
      getRpcClient: async () => {
        throw new Error("ws not used");
      },
    });
    await expect(client.call("tls.ca", {})).rejects.toThrow(/callRaw/);
  });
});
