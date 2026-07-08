import { afterEach, describe, expect, it } from "bun:test";

import { isCapacitorRuntime, isMobileCapacitorShellCandidate } from "./shared.ts";

describe("shell-bridge shared", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("isMobileCapacitorShellCandidate 桌面浏览器为 false", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;

    expect(isMobileCapacitorShellCandidate()).toBe(false);
  });

  it("isMobileCapacitorShellCandidate Android WebView 无 window.Capacitor 仍为 true", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
    } as unknown as Window;

    expect(isCapacitorRuntime()).toBe(false);
    expect(isMobileCapacitorShellCandidate()).toBe(true);
  });
});
