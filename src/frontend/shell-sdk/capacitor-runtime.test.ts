import { afterEach, describe, expect, it } from "bun:test";

import { isCapacitorNativePlatform, isCapacitorShellCandidate } from "./capacitor-runtime.ts";

describe("isCapacitorShellCandidate", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("桌面浏览器为 false", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
      location: { origin: "https://hub.example.com" },
    } as unknown as Window;

    expect(isCapacitorShellCandidate()).toBe(false);
  });

  it("手机浏览器直连远程 Habitat 不为 Capacitor 候选", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile)" },
      location: { origin: "https://anima.fengtrace.me" },
    } as unknown as Window;

    expect(isCapacitorNativePlatform()).toBe(false);
    expect(isCapacitorShellCandidate()).toBe(false);
  });

  it("薄壳 localhost + 移动 UA 仍为候选（无 window.Capacitor）", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { origin: "http://localhost" },
    } as unknown as Window;

    expect(isCapacitorNativePlatform()).toBe(false);
    expect(isCapacitorShellCandidate()).toBe(true);
  });

  it("远程 Habitat + nativePromise 视为真壳", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { origin: "https://hub.example.com" },
      Capacitor: {
        nativePromise: async () => ({}),
      },
    } as unknown as Window;

    expect(isCapacitorNativePlatform()).toBe(true);
    expect(isCapacitorShellCandidate()).toBe(true);
  });

  it("isNativeShell 视为候选", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
      location: { origin: "https://hub.example.com" },
      satelliteShell: { isNativeShell: true, isElectron: false },
    } as unknown as Window;

    expect(isCapacitorShellCandidate()).toBe(true);
  });
});
