import { afterEach, describe, expect, it } from "bun:test";
import type { ShellApi } from "@freeanima/frontend/shell-sdk";

import { hasEnterToSendCapability, hasFinePointerCapability } from "./shell-capability.ts";

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

describe("shell-capability", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  function installWindow(shell?: ShellApi) {
    (globalThis as { window: Window }).window = {
      ...(shell ? { satelliteShell: shell } : {}),
      matchMedia: () =>
        ({
          matches: false,
          media: "",
          onchange: null,
          addEventListener: () => {},
          removeEventListener: () => {},
          addListener: () => {},
          removeListener: () => {},
          dispatchEvent: () => false,
        }) satisfies MediaQueryList,
    } as unknown as Window;
  }

  it("Electron 窄窗仍为 pointer（与布局正交）", () => {
    installWindow({ isElectron: true } as ShellApi);
    mockMedia(false);
    expect(hasFinePointerCapability()).toBe(true);
  });

  it("Capacitor 宽屏（如 iPad）仍为 touch", () => {
    installWindow({ isNativeShell: true, isElectron: false } as ShellApi);
    mockMedia(true);
    expect(hasFinePointerCapability()).toBe(false);
  });

  it("Web 跟随 pointer/hover 媒体查询", () => {
    installWindow();
    mockMedia(true);
    expect(hasFinePointerCapability()).toBe(true);
    mockMedia(false);
    expect(hasFinePointerCapability()).toBe(false);
  });

  it("hasEnterToSendCapability 跟随 pointer", () => {
    installWindow();
    mockMedia(true);
    expect(hasEnterToSendCapability()).toBe(true);
    mockMedia(false);
    expect(hasEnterToSendCapability()).toBe(false);
  });

  it("Capacitor 宽屏仍不 Enter 发送", () => {
    installWindow({ isNativeShell: true, isElectron: false } as ShellApi);
    mockMedia(true);
    expect(hasEnterToSendCapability()).toBe(false);
  });
});
