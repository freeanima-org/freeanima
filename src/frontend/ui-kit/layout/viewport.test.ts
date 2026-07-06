import { afterEach, describe, expect, it } from "bun:test";

import { isMobileLayoutViewport, isNativeShell, MOBILE_LAYOUT_MQ } from "./viewport.ts";
import { windowWithSatelliteShell } from "./window-shell.ts";

const hasWindow = typeof globalThis.window !== "undefined";

describe("layout viewport", () => {
  if (!hasWindow) {
    it.skip("需要 DOM 环境", () => {});
    return;
  }

  const win = windowWithSatelliteShell();
  const originalShell = win.satelliteShell;
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    if (originalShell !== undefined) {
      win.satelliteShell = originalShell;
    } else {
      delete win.satelliteShell;
    }
    window.matchMedia = originalMatchMedia;
  });

  it("MOBILE_LAYOUT_MQ matches task/chat breakpoint", () => {
    expect(MOBILE_LAYOUT_MQ).toBe("(max-width: 767px)");
  });

  it("isNativeShell reads satelliteShell flag", () => {
    win.satelliteShell = { isNativeShell: true };
    expect(isNativeShell()).toBe(true);
    delete win.satelliteShell;
    expect(isNativeShell()).toBe(false);
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
