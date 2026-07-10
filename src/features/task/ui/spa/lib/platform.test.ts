import { afterEach, describe, expect, it } from "bun:test";
import type { SatelliteShellApi } from "@freeanima/frontend/shell-sdk";

import { isMobileLayoutViewport, isNativeShell, isWebShell } from "./platform.ts";

const hasWindow = typeof globalThis.window !== "undefined";

function clearSatelliteShell(): void {
  delete window.satelliteShell;
}

describe("task platform", () => {
  if (!hasWindow) {
    it.skip("需要 DOM 环境", () => {});
    return;
  }

  const originalShell = window.satelliteShell;
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    if (originalShell !== undefined) {
      window.satelliteShell = originalShell;
    } else {
      clearSatelliteShell();
    }
    window.matchMedia = originalMatchMedia;
  });

  it("isNativeShell reads satelliteShell flag", () => {
    window.satelliteShell = { isNativeShell: true } as SatelliteShellApi;
    expect(isNativeShell()).toBe(true);
    clearSatelliteShell();
    expect(isNativeShell()).toBe(false);
  });

  it("isWebShell is inverse of native shell", () => {
    window.satelliteShell = { isNativeShell: true } as SatelliteShellApi;
    expect(isWebShell()).toBe(false);
    clearSatelliteShell();
    expect(isWebShell()).toBe(true);
  });

  it("isMobileLayoutViewport uses matchMedia", () => {
    window.matchMedia = ((query: string) =>
      ({
        matches: query.includes("767px"),
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) satisfies MediaQueryList) as typeof window.matchMedia;
    expect(isMobileLayoutViewport()).toBe(true);
  });
});
