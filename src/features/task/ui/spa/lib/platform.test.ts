import { afterEach, describe, expect, it } from "bun:test";
import type { ShellApi } from "@freeanima/frontend/shell-sdk";

import { isCompactLayoutViewport, isNativeShell, isWebShell } from "./platform.ts";

describe("task platform", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("isNativeShell reads satelliteShell flag", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isNativeShell: true } as ShellApi,
    } as unknown as Window;
    expect(isNativeShell()).toBe(true);
    (globalThis as { window: Window }).window = {} as unknown as Window;
    expect(isNativeShell()).toBe(false);
  });

  it("isWebShell：Tauri 不是 web", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isTauri: true, isNativeShell: true } as ShellApi,
      location: {
        origin: "https://example.com",
        protocol: "https:",
        hostname: "example.com",
      },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(isWebShell()).toBe(false);
  });

  it("isWebShell：无壳为 web", () => {
    (globalThis as { window: Window }).window = {
      location: { origin: "https://example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(isWebShell()).toBe(true);
  });

  it("isCompactLayoutViewport uses matchMedia", () => {
    (globalThis as { window: Window }).window = {
      matchMedia: ((query: string) =>
        ({
          matches: query.includes("767px"),
          media: query,
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) satisfies MediaQueryList) as typeof window.matchMedia,
    } as unknown as Window;
    expect(isCompactLayoutViewport()).toBe(true);
  });
});
