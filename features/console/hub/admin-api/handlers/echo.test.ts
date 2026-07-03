import { describe, expect, test } from "bun:test";
import { ANIMA_REMOTE_ADDRESS_HEADER } from "../http-dispatch.ts";
import { buildEchoSnapshot } from "./echo.ts";

describe("buildEchoSnapshot", () => {
  test("echoes GET with query string", async () => {
    const snapshot = await buildEchoSnapshot(
      new Request("https://anima.example.com/api/echo?x=1", {
        headers: { "X-Test": "abc" },
      }),
    );
    expect(snapshot.method).toBe("GET");
    expect(snapshot.host).toBe("anima.example.com");
    expect(snapshot.pathname).toBe("/api/echo");
    expect(snapshot.search).toBe("?x=1");
    expect(snapshot.headers["x-test"]).toBe("abc");
    expect(snapshot.body).toBeNull();
    expect(snapshot.remote_address).toBeNull();
  });

  test("echoes POST body verbatim", async () => {
    const snapshot = await buildEchoSnapshot(
      new Request("http://127.0.0.1:2658/api/echo", {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: "hello echo",
      }),
    );
    expect(snapshot.body).toBe("hello echo");
  });

  test("includes remote_address and auth_hint", async () => {
    const snapshot = await buildEchoSnapshot(
      new Request("https://anima.example.com/api/echo", {
        headers: {
          [ANIMA_REMOTE_ADDRESS_HEADER]: "127.0.0.1",
          "cf-ray": "abc",
        },
      }),
    );
    expect(snapshot.host).toBe("anima.example.com");
    expect(snapshot.remote_address).toBe("127.0.0.1");
    expect(snapshot.headers[ANIMA_REMOTE_ADDRESS_HEADER]).toBeUndefined();
    expect(snapshot.auth_hint.is_loopback_peer).toBe(true);
    expect(snapshot.auth_hint.has_cloudflare_proxy_headers).toBe(true);
  });
});
