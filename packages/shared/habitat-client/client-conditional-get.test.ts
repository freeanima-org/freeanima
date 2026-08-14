import { describe, expect, test } from "bun:test";

import { createHabitatClient } from "./client.ts";

describe("createHabitatClient conditional GET", () => {
  test("second identical GET reuses body on 304", async () => {
    const body = { version: "1", ok: true };
    const etag = '"etag-1"';
    let calls = 0;
    const client = createHabitatClient({
      httpOrigin: "http://127.0.0.1:2658",
      fetch: (async (_input, init) => {
        calls += 1;
        const headers = new Headers(init?.headers);
        if (calls === 1) {
          expect(headers.get("If-None-Match")).toBeNull();
          return new Response(JSON.stringify(body), {
            status: 200,
            headers: { "Content-Type": "application/json", ETag: etag },
          });
        }
        expect(headers.get("If-None-Match")).toBe(etag);
        return new Response(null, { status: 304, headers: { ETag: etag } });
      }) as typeof fetch,
      getRpcClient: async () => {
        throw new Error("ws not used");
      },
    });

    const first = await client.call("status.get", {}, { transport: "http" });
    const second = await client.call("status.get", {}, { transport: "http" });
    expect(first).toEqual(body);
    expect(second).toEqual(body);
    expect(calls).toBe(2);
  });
});
