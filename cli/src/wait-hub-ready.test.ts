import { describe, it, expect, afterEach } from "bun:test";
import { waitForHubReady } from "./wait-hub-ready.ts";

describe("waitForHubReady", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("returns true when /api/health status is ok", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;

    const ok = await waitForHubReady("127.0.0.1", 2658, {
      timeoutMs: 2000,
      intervalMs: 50,
    });
    expect(ok).toBe(true);
  });

  it("returns false on timeout", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "starting" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;

    const ok = await waitForHubReady("127.0.0.1", 2658, {
      timeoutMs: 200,
      intervalMs: 50,
    });
    expect(ok).toBe(false);
  });
});
