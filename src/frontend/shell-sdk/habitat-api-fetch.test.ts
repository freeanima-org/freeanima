import { afterEach, describe, expect, mock, test } from "bun:test";

import { resolveHabitatApiFetch } from "./habitat-api-fetch.ts";
import { REMOTE_AUTH_TOKEN_KEY } from "./settings/prefs-keys.ts";

type ShellStub = {
  habitatUrl?: string;
  habitatFetch?: typeof fetch;
  remoteAuth?: { token?: string };
};

function stubWindow(shell: ShellStub): void {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    writable: true,
    value: {
      satelliteShell: shell,
      location: { origin: "http://127.0.0.1:2658" },
    },
  });
}

describe("resolveHabitatApiFetch", () => {
  const originalFetch = globalThis.fetch;
  const originalWindowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");

  afterEach(() => {
    globalThis.fetch = originalFetch;
    try {
      localStorage.removeItem(REMOTE_AUTH_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    if (originalWindowDescriptor) {
      Object.defineProperty(globalThis, "window", originalWindowDescriptor);
    } else {
      Reflect.deleteProperty(globalThis, "window");
    }
  });

  test("有 remoteAuth.token 时优先 renderer 内 Bearer，不调用 shell.habitatFetch", async () => {
    const bridgeFetch = mock(async () => {
      throw new Error("不应走 contextBridge habitatFetch");
    });
    let seenAuth = "";
    globalThis.fetch = (async (_input, init) => {
      seenAuth = String(new Headers(init?.headers).get("Authorization") ?? "");
      return new Response("{}", { status: 200 });
    }) as typeof fetch;

    stubWindow({
      habitatUrl: "http://127.0.0.1:2658",
      remoteAuth: { token: "secret-token-min-16" },
      habitatFetch: bridgeFetch as unknown as typeof fetch,
    });

    const habitatFetch = resolveHabitatApiFetch();
    await habitatFetch("http://127.0.0.1:2658/rpc/v1/config/getSection?section=llm");

    expect(bridgeFetch).not.toHaveBeenCalled();
    expect(seenAuth).toBe("Bearer secret-token-min-16");
  });

  test("无 token 时回退 shell.habitatFetch", async () => {
    try {
      localStorage.removeItem(REMOTE_AUTH_TOKEN_KEY);
    } catch {
      /* ignore */
    }
    const bridgeFetch = mock(
      async () => new Response("{}", { status: 200 }),
    ) as unknown as typeof fetch;
    stubWindow({
      habitatUrl: "http://127.0.0.1:2658",
      habitatFetch: bridgeFetch,
    });

    const habitatFetch = resolveHabitatApiFetch();
    await habitatFetch("http://127.0.0.1:2658/rpc/v1/health/probe");

    expect(bridgeFetch).toHaveBeenCalled();
  });
});
