import { afterEach, describe, expect, it } from "bun:test";

import {
  readCapacitorBundledJson,
  resolveCapacitorBundledAssetUrl,
} from "./capacitor-local-asset.ts";

describe("capacitor-local-asset", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
    delete (globalThis as { fetch?: typeof fetch }).fetch;
  });

  it("resolveCapacitorBundledAssetUrl 使用 Capacitor config hostname/scheme", () => {
    (globalThis as { window: Window }).window = {
      Capacitor: {
        config: { androidScheme: "https", hostname: "localhost" },
        getPlatform: () => "android",
        isNativePlatform: () => true,
      },
    } as unknown as Window;

    expect(resolveCapacitorBundledAssetUrl("native-build-meta.json")).toBe(
      "https://localhost/native-build-meta.json",
    );
  });

  it("readCapacitorBundledJson 优先 fetch", async () => {
    (globalThis as { window: Window }).window = {
      Capacitor: {
        config: { androidScheme: "https", hostname: "localhost" },
        getPlatform: () => "android",
        isNativePlatform: () => true,
      },
    } as unknown as Window;

    (globalThis as { fetch: typeof fetch }).fetch = (async () =>
      ({
        ok: true,
        json: async () => ({
          component: "native",
          shell: "mobile",
          version: "1.0.0",
          channel: "dev",
        }),
      }) as Response) as unknown as typeof fetch;

    const raw = await readCapacitorBundledJson("/native-build-meta.json");
    expect((raw as { version?: string }).version).toBe("1.0.0");
  });

  it("readCapacitorBundledJson Android WebView 无 window.Capacitor 仍可读", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
    } as unknown as Window;

    (globalThis as { fetch: typeof fetch }).fetch = (async (url: string) => {
      expect(url).toBe("https://localhost/native-build-meta.json");
      return {
        ok: true,
        json: async () => ({
          component: "native",
          shell: "mobile",
          version: "0.8.3",
          channel: "prod",
        }),
      } as Response;
    }) as unknown as typeof fetch;

    const raw = await readCapacitorBundledJson("/native-build-meta.json");
    expect((raw as { version?: string }).version).toBe("0.8.3");
  });
});
