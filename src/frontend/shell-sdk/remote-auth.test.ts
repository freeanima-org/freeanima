import { describe, expect, test } from "bun:test";

import {
  createBearerFetch,
  isLoopbackHabitatUrl,
  resolveConnectAuthToken,
  shouldAttachRemoteAuth,
} from "./remote-auth.ts";

describe("remote-auth helpers", () => {
  test("isLoopbackHabitatUrl", () => {
    expect(isLoopbackHabitatUrl("http://127.0.0.1:2658")).toBe(true);
    expect(isLoopbackHabitatUrl("https://anima.example.com")).toBe(false);
  });

  test("shouldAttachRemoteAuth when token configured", () => {
    expect(shouldAttachRemoteAuth("https://anima.example.com", "tok")).toBe(true);
    expect(shouldAttachRemoteAuth("http://127.0.0.1:2658", "tok")).toBe(true);
    expect(shouldAttachRemoteAuth("https://anima.example.com", "")).toBe(false);
  });

  test("resolveConnectAuthToken", () => {
    expect(resolveConnectAuthToken("https://x.com", "abc")).toBe("abc");
    expect(resolveConnectAuthToken("http://127.0.0.1:2658", "abc")).toBe("abc");
    expect(resolveConnectAuthToken("http://127.0.0.1:2658", "")).toBeUndefined();
  });

  test("createBearerFetch adds Authorization for hub origin on loopback", async () => {
    const originalFetch = globalThis.fetch;
    let seenAuth = "";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    try {
      const habitatFetch = createBearerFetch("secret-token-min-16", "http://127.0.0.1:2658");
      await habitatFetch("http://127.0.0.1:2658/rpc/v1/health/probe");
      expect(seenAuth).toBe("Bearer secret-token-min-16");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("createBearerFetch Request 入参保留 method 并附加 Bearer", async () => {
    const originalFetch = globalThis.fetch;
    let seenAuth = "";
    let seenMethod = "";
    globalThis.fetch = (async (input) => {
      if (input instanceof Request) {
        seenAuth = input.headers.get("Authorization") ?? "";
        seenMethod = input.method;
      }
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    try {
      const habitatFetch = createBearerFetch("secret-token-min-16", "https://hub.example.com");
      await habitatFetch(new Request("https://hub.example.com/api/status", { method: "GET" }));
      expect(seenAuth).toBe("Bearer secret-token-min-16");
      expect(seenMethod).toBe("GET");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("createBearerFetch 可注入底层 fetch", async () => {
    let calledCustom = false;
    const customFetch: import("./remote-auth.ts").HabitatFetch = async () => {
      calledCustom = true;
      return new Response("ok", { status: 200 });
    };
    const habitatFetch = createBearerFetch(
      "secret-token-min-16",
      "http://127.0.0.1:2658",
      customFetch,
    );
    await habitatFetch("http://127.0.0.1:2658/rpc/v1/tts/synthesize", { method: "POST" });
    expect(calledCustom).toBe(true);
  });
});
