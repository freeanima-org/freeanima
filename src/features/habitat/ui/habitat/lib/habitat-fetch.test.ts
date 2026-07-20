import { afterEach, describe, expect, test } from "bun:test";

import { createBearerFetch } from "@freeanima/frontend/shell-sdk/remote-auth";

import { resetHabitatFetchCache, resolveHabitatFetch } from "./habitat-fetch.ts";

type MockShell = {
  habitatUrl?: string;
  habitatFetch?: typeof fetch;
  remoteAuth?: { token?: string };
  isElectron?: boolean;
};

function setShell(shell: MockShell): void {
  (
    globalThis as unknown as {
      window: { satelliteShell?: MockShell; location: { origin: string } };
    }
  ).window = {
    satelliteShell: shell,
    location: { origin: "http://127.0.0.1:4175" },
  };
}

describe("resolveHabitatFetch", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetHabitatFetchCache();
    (globalThis as typeof globalThis & { window?: Window }).window = originalWindow;
  });

  test("远程 Habitat 使用 remoteAuth.token 附加 Bearer", async () => {
    let seenAuth = "";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    setShell({
      habitatUrl: "https://anima.example.com",
      remoteAuth: { token: "secret-token-min-16" },
      isElectron: true,
    });

    await resolveHabitatFetch()("https://anima.example.com/rpc/v1/health/probe");
    expect(seenAuth).toBe("Bearer secret-token-min-16");
  });

  test("loopback Habitat 有 token 时仍附加 Bearer", async () => {
    let seenAuth = "unset";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    setShell({
      habitatUrl: "http://127.0.0.1:2658",
      remoteAuth: { token: "secret-token-min-16" },
      isElectron: true,
    });

    await resolveHabitatFetch()("http://127.0.0.1:2658/rpc/v1/health/probe");
    expect(seenAuth).toBe("Bearer secret-token-min-16");
  });

  test("createBearerFetch 支持 Request 入参", async () => {
    let seenAuth = "";
    globalThis.fetch = (async (input) => {
      seenAuth = input instanceof Request ? (input.headers.get("Authorization") ?? "") : "";
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const habitatFetch = createBearerFetch("secret-token-min-16", "https://hub.example.com");
    await habitatFetch(new Request("https://hub.example.com/api/status", { method: "GET" }));
    expect(seenAuth).toBe("Bearer secret-token-min-16");
  });
});
