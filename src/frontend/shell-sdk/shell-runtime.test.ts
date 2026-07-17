import { afterEach, describe, expect, it } from "bun:test";
import type { SatelliteShellApi } from "@freeanima/frontend/shell-sdk";

import { isCapacitorShellCandidate } from "./capacitor-runtime.ts";
import {
  canOpenHubSettings,
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
      satelliteShell: { isElectron: true } as SatelliteShellApi,
      location: { origin: "https://example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("electron");
  });

  it("getShellKind：Capacitor isNativeShell", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: false, isNativeShell: true } as SatelliteShellApi,
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
      satelliteShell: { isElectron: false, isNativeShell: true } as SatelliteShellApi,
    } as unknown as Window;
    expect(isNativeShell()).toBe(true);
    (globalThis as { window: Window }).window = {} as unknown as Window;
    expect(isNativeShell()).toBe(false);
  });

  it("canOpenHubSettings：有 openHubSettings", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: {
        isElectron: false,
        openHubSettings: () => {},
      } as SatelliteShellApi,
    } as unknown as Window;
    expect(canOpenHubSettings()).toBe(true);
  });

  it("canOpenHubSettings：Electron 无方法仍 true（packaged）", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: true } as SatelliteShellApi,
    } as unknown as Window;
    expect(canOpenHubSettings()).toBe(true);
  });

  it("shouldUseNativeShellNavigation：isNativeShell", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: { isElectron: false, isNativeShell: true } as SatelliteShellApi,
    } as unknown as Window;
    expect(shouldUseNativeShellNavigation()).toBe(true);
  });
});
