import { describe, expect, test } from "bun:test";

import {
  createBearerFetch,
  isLoopbackHubUrl,
  resolveConnectAuthToken,
  shouldAttachRemoteAuth,
} from "./remote-auth.ts";

describe("remote-auth helpers", () => {
  test("isLoopbackHubUrl", () => {
    expect(isLoopbackHubUrl("http://127.0.0.1:2658")).toBe(true);
    expect(isLoopbackHubUrl("https://anima.example.com")).toBe(false);
  });

  test("shouldAttachRemoteAuth", () => {
    expect(shouldAttachRemoteAuth("https://anima.example.com", "tok")).toBe(true);
    expect(shouldAttachRemoteAuth("http://127.0.0.1:2658", "tok")).toBe(false);
    expect(shouldAttachRemoteAuth("https://anima.example.com", "")).toBe(false);
  });

  test("resolveConnectAuthToken", () => {
    expect(resolveConnectAuthToken("https://x.com", "abc")).toBe("abc");
    expect(resolveConnectAuthToken("http://127.0.0.1:2658", "abc")).toBeUndefined();
  });

  test("createBearerFetch adds Authorization for hub origin", async () => {
    const originalFetch = globalThis.fetch;
    let seenAuth = "";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("ok", { status: 200 });
    }) as typeof fetch;
    try {
      const hubFetch = createBearerFetch("secret-token-min-16", "https://hub.example.com");
      await hubFetch("https://hub.example.com/api/health");
      expect(seenAuth).toBe("Bearer secret-token-min-16");
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
