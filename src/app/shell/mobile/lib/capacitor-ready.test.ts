import { afterEach, describe, expect, it } from "bun:test";

import { waitForCapacitorBridge } from "./capacitor-ready.ts";

describe("waitForCapacitorBridge", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("桌面浏览器立即返回", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;
    await expect(waitForCapacitorBridge(100)).resolves.toBeUndefined();
  });

  it("Android 候选在 nativePromise 就绪后返回", async () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      Capacitor: {
        nativePromise: async () => ({}),
      },
    } as unknown as Window;
    await expect(waitForCapacitorBridge(200)).resolves.toBeUndefined();
  });
});
