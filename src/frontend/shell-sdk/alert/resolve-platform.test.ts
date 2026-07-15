import { afterEach, describe, expect, it } from "bun:test";

import { isCapacitorShellRuntime, resolveAlertDisplayPlatform } from "./resolve-platform.ts";
import type { AlertBackend } from "./types.ts";

describe("resolveAlertDisplayPlatform", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("非 web backend 直接沿用", () => {
    const backend = { platform: "mobile" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("mobile");
  });

  it("web backend + 手机浏览器直连 Hub 保持 web（不跟 UA）", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile)" },
      location: { origin: "https://hub.example.com" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("web");
    expect(isCapacitorShellRuntime()).toBe(false);
  });

  it("web backend + Capacitor nativePromise 展示 mobile", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { origin: "https://hub.example.com" },
      Capacitor: {
        nativePromise: async () => ({}),
      },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("mobile");
    expect(isCapacitorShellRuntime()).toBe(true);
  });

  it("web backend + isNativeShell 展示 mobile", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isNativeShell: true, isElectron: false },
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("mobile");
    expect(isCapacitorShellRuntime()).toBe(true);
  });

  it("桌面浏览器保持 web", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("web");
  });
});
