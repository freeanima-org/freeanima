import { afterEach, describe, expect, it } from "bun:test";
import type { ShellApi } from "@freeanima/frontend/shell-sdk";

import { isCapacitorShellCandidate } from "./capacitor-runtime.ts";
import {
  canOpenHabitatSettings,
  getShellKind,
  isNativeShell,
  shouldUseNativeShellNavigation,
} from "./shell-runtime.ts";

describe("shell-runtime", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("getShellKind：Electron", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: true } as ShellApi,
      location: { origin: "https://example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("electron");
  });

  it("getShellKind：Capacitor isNativeShell", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: false, isNativeShell: true } as ShellApi,
      location: { origin: "https://example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("capacitor");
  });

  it("getShellKind：Web 默认", () => {
    (globalThis as { window: Window }).window = {
      location: { origin: "https://example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("web");
    expect(isCapacitorShellCandidate()).toBe(false);
  });

  it("isNativeShell 读 flag", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: false, isNativeShell: true } as ShellApi,
    } as unknown as Window;
    expect(isNativeShell()).toBe(true);
    (globalThis as { window: Window }).window = {} as unknown as Window;
    expect(isNativeShell()).toBe(false);
  });

  it("canOpenHabitatSettings：有 openHabitatSettings", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: {
        isElectron: false,
        openHabitatSettings: () => {},
      } as ShellApi,
    } as unknown as Window;
    expect(canOpenHabitatSettings()).toBe(true);
  });

  it("canOpenHabitatSettings：Electron 无方法仍 true（packaged）", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: true } as ShellApi,
    } as unknown as Window;
    expect(canOpenHabitatSettings()).toBe(true);
  });

  it("shouldUseNativeShellNavigation：isNativeShell", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: false, isNativeShell: true } as ShellApi,
    } as unknown as Window;
    expect(shouldUseNativeShellNavigation()).toBe(true);
  });
});
