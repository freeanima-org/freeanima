import { afterEach, describe, expect, it } from "bun:test";

import { setShellBuildTargetForTests } from "../shell-build-target.ts";
import { isCapacitorShellRuntime, resolveAlertDisplayPlatform } from "./resolve-platform.ts";
import type { AlertBackend } from "./types.ts";

describe("resolveAlertDisplayPlatform", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
    setShellBuildTargetForTests(null);
  });

  it("非 web backend 直接沿用", () => {
    const backend = { platform: "mobile" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("mobile");
  });

  it("web backend + 手机浏览器直连 Habitat 保持 web", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14; Mobile)" },
      location: { origin: "https://hub.example.com" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("web");
    expect(isCapacitorShellRuntime()).toBe(false);
  });

  it("编译期 desktop 展示 desktop", () => {
    setShellBuildTargetForTests("desktop");
    (globalThis as { window: Window }).window = {
      satelliteShell: { isNativeShell: true, isTauri: true },
      navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" },
      location: { protocol: "https:", hostname: "tauri.localhost" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("desktop");
  });

  it("编译期 mobile 展示 mobile", () => {
    setShellBuildTargetForTests("mobile");
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("mobile");
  });

  it("Tauri touch 展示 mobile", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: {
        isNativeShell: true,
        isTauri: true,
        primaryInput: "touch",
        showNativeAlert: async () => {},
      },
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { protocol: "https:", hostname: "tauri.localhost" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("mobile");
  });

  it("桌面浏览器保持 web", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("web");
  });

  it("web backend + showNativeAlert pointer 展示 desktop", () => {
    (globalThis as { window: Window }).window = {
      satelliteShell: {
        primaryInput: "pointer",
        showNativeAlert: async () => {},
      },
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;
    const backend = { platform: "web" } as AlertBackend;
    expect(resolveAlertDisplayPlatform(backend)).toBe("desktop");
  });
});
