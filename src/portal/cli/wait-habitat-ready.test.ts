import { describe, it, expect, afterEach } from "bun:test";
import { waitForHabitatReady } from "./wait-habitat-ready.ts";

describe("waitForHabitatReady", () => {
  const origFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = origFetch;
  });

  it("returns true when /rpc/v1/health/probe status is ok", async () => {
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "ok" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;

    const ok = await waitForHabitatReady("127.0.0.1", 2658, {
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

    const ok = await waitForHabitatReady("127.0.0.1", 2658, {
      timeoutMs: 200,
      intervalMs: 50,
    });
    expect(ok).toBe(false);
  });

  it("returns false when stillAlive becomes false", async () => {
    let alive = true;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ status: "starting" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })) as unknown as typeof fetch;

    const ready = waitForHabitatReady("127.0.0.1", 2658, {
      timeoutMs: 5000,
      intervalMs: 50,
      stillAlive: () => alive,
    });
    setTimeout(() => {
      alive = false;
    }, 80);
    expect(await ready).toBe(false);
  });
});
