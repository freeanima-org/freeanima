import { afterEach, describe, expect, mock, test } from "bun:test";

import { resolveHubApiFetch } from "./hub-api-fetch.ts";

type ShellStub = {
  hubUrl?: string;
  hubFetch?: typeof fetch;
  remoteAuth?: { token?: string };
};

describe("resolveHubApiFetch", () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    if (originalWindow === undefined) {
      // @ts-expect-error test cleanup
      delete globalThis.window;
    } else {
      globalThis.window = originalWindow;
    }
  });

  test("有 remoteAuth.token 时优先 renderer 内 Bearer，不调用 shell.hubFetch", async () => {
    const bridgeFetch = mock(async () => {
      throw new Error("不应走 contextBridge hubFetch");
    });
    let seenAuth = "";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    const shell: ShellStub = {
      hubUrl: "http://127.0.0.1:2658",
      remoteAuth: { token: "secret-token-min-16" },
      hubFetch: bridgeFetch as unknown as typeof fetch,
    };
    // @ts-expect-error test stub
    globalThis.window = { satelliteShell: shell };

    const hubFetch = resolveHubApiFetch();
    await hubFetch("http://127.0.0.1:2658/hub/rpc/v1/config/getSection?section=llm");

    expect(bridgeFetch).not.toHaveBeenCalled();
    expect(seenAuth).toBe("Bearer secret-token-min-16");
  });

  test("无 token 时回退 shell.hubFetch", async () => {
    const bridgeFetch = mock(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    const shell: ShellStub = {
      hubUrl: "http://127.0.0.1:2658",
      hubFetch: bridgeFetch,
    };
    // @ts-expect-error test stub
    globalThis.window = { satelliteShell: shell };

    const hubFetch = resolveHubApiFetch();
    await hubFetch("http://127.0.0.1:2658/hub/rpc/v1/health/probe");

    expect(bridgeFetch).toHaveBeenCalled();
  });
});
