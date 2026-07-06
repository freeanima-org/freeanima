import { afterEach, describe, expect, test } from "bun:test";

import { resolveSettingsChromePlatform, resolveSettingsContentPlatform } from "../spa/platform.ts";

describe("resolveSettingsChromePlatform", () => {
  test("compact layoutMode 为 mobile settings chrome", () => {
    expect(resolveSettingsChromePlatform({ layoutMode: "compact" })).toBe("mobile");
  });

  test("expanded layoutMode 为 desktop settings chrome", () => {
    expect(resolveSettingsChromePlatform({ layoutMode: "expanded" })).toBe("desktop");
  });

  test("默认 desktop", () => {
    expect(resolveSettingsChromePlatform({})).toBe("desktop");
  });
});

describe("resolveSettingsContentPlatform", () => {
  const originalShell = globalThis.window?.satelliteShell;

  test("Electron 壳为 desktop", () => {
    (globalThis as typeof globalThis & { window: Window }).window = {
      satelliteShell: { isElectron: true },
    } as Window;
    expect(resolveSettingsContentPlatform()).toBe("desktop");
  });

  test("Capacitor 原生壳为 mobile", () => {
    (globalThis as typeof globalThis & { window: Window }).window = {
      satelliteShell: { isNativeShell: true, isElectron: false },
    } as Window;
    expect(resolveSettingsContentPlatform()).toBe("mobile");
  });

  test("Web 无壳为 desktop", () => {
    (globalThis as typeof globalThis & { window: Window }).window = {} as Window;
    expect(resolveSettingsContentPlatform()).toBe("desktop");
  });

  afterEach(() => {
    if (originalShell !== undefined) {
      (globalThis.window as Window).satelliteShell = originalShell;
    } else {
      delete (globalThis.window as Window).satelliteShell;
    }
  });
});
