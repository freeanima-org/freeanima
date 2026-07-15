import { afterEach, describe, expect, it } from "bun:test";

import { detectShellRuntimeKind } from "./shell-composition.ts";

describe("detectShellRuntimeKind", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("手机浏览器直连 Hub 为 web（不因 UA 判 capacitor）", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
      location: { origin: "https://hub.example.com" },
      satelliteShell: { isElectron: false },
    } as unknown as Window;

    expect(detectShellRuntimeKind()).toBe("web");
  });

  it("Capacitor 原生桥为 capacitor", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { origin: "https://hub.example.com" },
      Capacitor: {
        nativePromise: async () => ({}),
      },
    } as unknown as Window;

    expect(detectShellRuntimeKind()).toBe("capacitor");
  });

  it("isNativeShell 为 capacitor", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
      location: { origin: "https://hub.example.com" },
      satelliteShell: { isNativeShell: true, isElectron: false },
    } as unknown as Window;

    expect(detectShellRuntimeKind()).toBe("capacitor");
  });

  it("Electron 为 electron", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
      location: { origin: "https://hub.example.com" },
      satelliteShell: { isElectron: true },
    } as unknown as Window;

    expect(detectShellRuntimeKind()).toBe("electron");
  });
});
