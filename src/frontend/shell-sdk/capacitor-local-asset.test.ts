import { afterEach, describe, expect, it } from "bun:test";

import { detectCapacitorShellForBootstrap } from "./capacitor-local-asset.ts";

describe("detectCapacitorShellForBootstrap", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete (globalThis as { window?: Window }).window;
  });

  it("桌面浏览器走 Web bridge", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;

    await expect(detectCapacitorShellForBootstrap()).resolves.toBe(false);
  });

  it("手机浏览器直连 Hub 时走 Web bridge（无 localhost 资产）", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile)" },
    } as unknown as Window;
    globalThis.fetch = (async () => new Response(null, { status: 404 })) as unknown as typeof fetch;

    await expect(detectCapacitorShellForBootstrap()).resolves.toBe(false);
  });

  it("Capacitor WebView 远程 Hub 页可读 localhost 资产时走 Capacitor bridge", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
    } as unknown as Window;
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ component: "mobile", version: "1.0.0" }), {
        status: 200,
      })) as unknown as typeof fetch;

    await expect(detectCapacitorShellForBootstrap()).resolves.toBe(true);
  });
});
