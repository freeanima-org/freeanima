import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

import { parlorPlatform, resetParlorInstanceCacheForTests } from "./sap-client.ts";

const originalFetch = globalThis.fetch;

describe("parlorPlatform", () => {
  beforeEach(() => {
    resetParlorInstanceCacheForTests();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  test("config 含 instance_id 时返回 sap:parlor:{id}", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ instance_id: "tou" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as unknown as typeof fetch;

    expect(await parlorPlatform()).toBe("sap:parlor:tou");
  });

  test("config 无 instance_id 时回退 sap:parlor:web", async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve(
        new Response(JSON.stringify({ app_id: "parlor" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ) as unknown as typeof fetch;

    expect(await parlorPlatform()).toBe("sap:parlor:web");
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

    expect(await parlorPlatform()).toBe("sap:parlor:b4i");
    expect(await parlorPlatform()).toBe("sap:parlor:b4i");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
