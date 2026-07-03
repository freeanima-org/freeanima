import { afterEach, describe, expect, test } from "bun:test";

import { createBearerFetch } from "@freeanima/shell-sdk/remote-auth";

import { resetHubFetchCache, resolveHubFetch } from "./hub-fetch.ts";

type MockShell = {
  hubUrl?: string;
  hubFetch?: typeof fetch;
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

describe("resolveHubFetch", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    resetHubFetchCache();
    (globalThis as typeof globalThis & { window?: Window }).window = originalWindow;
  });

  test("远程 Hub 使用 remoteAuth.token 附加 Bearer", async () => {
    let seenAuth = "";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    setShell({
      hubUrl: "https://anima.example.com",
      remoteAuth: { token: "secret-token-min-16" },
      isElectron: true,
    });

    await resolveHubFetch()("https://anima.example.com/api/health");
    expect(seenAuth).toBe("Bearer secret-token-min-16");
  });

  test("loopback Hub 不附加 Bearer", async () => {
    let seenAuth = "unset";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    setShell({
      hubUrl: "http://127.0.0.1:2658",
      remoteAuth: { token: "secret-token-min-16" },
      isElectron: true,
    });

    await resolveHubFetch()("http://127.0.0.1:2658/api/health");
    expect(seenAuth).toBe("");
  });

  test("createBearerFetch 支持 Request 入参", async () => {
    let seenAuth = "";
    globalThis.fetch = (async (input) => {
      seenAuth = input instanceof Request ? (input.headers.get("Authorization") ?? "") : "";
      return new Response("ok", { status: 200 });
    }) as typeof fetch;

    const hubFetch = createBearerFetch("secret-token-min-16", "https://hub.example.com");
    await hubFetch(new Request("https://hub.example.com/api/status", { method: "GET" }));
    expect(seenAuth).toBe("Bearer secret-token-min-16");
  });
});
