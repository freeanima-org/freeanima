import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { chatPlatform, resetChatInstanceCacheForTests } from "./sap-client.ts";

const originalFetch = globalThis.fetch;

describe("chatPlatform", () => {
  beforeEach(() => {
    resetChatInstanceCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("config 含 instance_id 时返回 sap:chat:{id}", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ instance_id: "tou" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as unknown as typeof fetch;

    expect(await chatPlatform()).toBe("sap:chat:tou");
  });

  test("config 无 instance_id 时抛出", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ app_id: "chat" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as unknown as typeof fetch;

    await expect(chatPlatform()).rejects.toThrow("instance_id is required");
  });

  test("instance_id 结果会被缓存", async () => {
    const fetchMock = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ instance_id: "b4i" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as unknown as typeof fetch;
    globalThis.fetch = fetchMock;

    expect(await chatPlatform()).toBe("sap:chat:b4i");
    expect(await chatPlatform()).toBe("sap:chat:b4i");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
