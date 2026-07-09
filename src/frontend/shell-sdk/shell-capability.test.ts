import { afterEach, describe, expect, it } from "bun:test";
import type { SatelliteShellApi } from "@freeanima/frontend/shell-sdk";

import { hasFinePointerCapability } from "./shell-capability.ts";

const hasWindow = typeof globalThis.window !== "undefined";

describe("shell-capability", () => {
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
      delete window.satelliteShell;
    }
    window.matchMedia = originalMatchMedia;
  });

  function mockMedia(finePointer: boolean) {
    window.matchMedia = ((query: string) =>
      ({
        matches:
          query.includes("pointer: fine") || query.includes("hover: hover") ? finePointer : false,
        media: query,
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }) satisfies MediaQueryList) as typeof window.matchMedia;
  }

  it("Electron 窄窗仍为 pointer（与布局正交）", () => {
    mockMedia(false);
    window.satelliteShell = { isElectron: true } as SatelliteShellApi;
    expect(hasFinePointerCapability()).toBe(true);
  });

  it("Capacitor 宽屏（如 iPad）仍为 touch", () => {
    mockMedia(true);
    window.satelliteShell = { isNativeShell: true, isElectron: false } as SatelliteShellApi;
    expect(hasFinePointerCapability()).toBe(false);
  });

  it("Web 跟随 pointer/hover 媒体查询", () => {
    mockMedia(true);
    delete window.satelliteShell;
    expect(hasFinePointerCapability()).toBe(true);
    mockMedia(false);
    expect(hasFinePointerCapability()).toBe(false);
  });
});
