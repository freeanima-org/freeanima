import { afterEach, describe, expect, it } from "bun:test";
import type { ShellApi } from "@freeanima/frontend/shell-sdk";

import { setShellBuildTargetForTests } from "./shell-build-target.ts";
import {
  canOpenHabitatSettings,
  getShellKind,
  isNativeShell,
  shouldUseNativeShellNavigation,
} from "./shell-runtime.ts";

describe("shell-runtime", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
    setShellBuildTargetForTests(null);
  });

  it("getShellKind：Tauri isTauri", () => {
    (globalThis as { window: Window }).window = {
      portalShell: { isTauri: true } as ShellApi,
      location: { origin: "https://example.com", protocol: "https:", hostname: "example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("tauri");
  });

  it("getShellKind：Tauri tauri.localhost（bridge 注入前）", () => {
    (globalThis as { window: Window }).window = {
      location: {
        origin: "https://tauri.localhost",
        protocol: "https:",
        hostname: "tauri.localhost",
      },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("tauri");
  });

  it("getShellKind：编译期 desktop 为 tauri", () => {
    setShellBuildTargetForTests("desktop");
    (globalThis as { window: Window }).window = {
      portalShell: { isNativeShell: true } as ShellApi,
      location: { origin: "https://example.com", protocol: "https:", hostname: "example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("tauri");
  });

  it("getShellKind：编译期 mobile 为 tauri", () => {
    setShellBuildTargetForTests("mobile");
    (globalThis as { window: Window }).window = {
      portalShell: { isNativeShell: true } as ShellApi,
      location: { origin: "https://example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("tauri");
  });

  it("getShellKind：Web 默认", () => {
    (globalThis as { window: Window }).window = {
      location: { origin: "https://example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(getShellKind()).toBe("web");
  });

  it("isNativeShell 读 flag", () => {
    (globalThis as { window: Window }).window = {
      portalShell: { isNativeShell: true } as ShellApi,
    } as unknown as Window;
    expect(isNativeShell()).toBe(true);
    (globalThis as { window: Window }).window = {} as unknown as Window;
    expect(isNativeShell()).toBe(false);
  });

  it("canOpenHabitatSettings：有 openHabitatSettings", () => {
    (globalThis as { window: Window }).window = {
      portalShell: {
        openHabitatSettings: () => {},
      } as ShellApi,
    } as unknown as Window;
    expect(canOpenHabitatSettings()).toBe(true);
  });

  it("canOpenHabitatSettings：Tauri packaged", () => {
    (globalThis as { window: Window }).window = {
      portalShell: { isTauri: true } as ShellApi,
    } as unknown as Window;
    expect(canOpenHabitatSettings()).toBe(true);
  });

  it("shouldUseNativeShellNavigation：isNativeShell", () => {
    (globalThis as { window: Window }).window = {
      portalShell: { isNativeShell: true } as ShellApi,
    } as unknown as Window;
    expect(shouldUseNativeShellNavigation()).toBe(true);
  });

  it("shouldUseNativeShellNavigation：编译期 desktop", () => {
    setShellBuildTargetForTests("desktop");
    (globalThis as { window: Window }).window = {
      location: { origin: "https://example.com" },
    } as unknown as Window;
    expect(shouldUseNativeShellNavigation()).toBe(true);
  });
});
