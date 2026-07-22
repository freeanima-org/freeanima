import { afterEach, describe, expect, test } from "bun:test";

import { setShellBuildTargetForTests } from "@freeanima/frontend/shell-sdk/shell-build-target.ts";

import { resolveSettingsChromePlatform, resolveSettingsContentPlatform } from "../spa/platform.ts";

type TestWindow = Window & typeof globalThis;

function setTestWindow(value: Partial<TestWindow>): void {
  (globalThis as { window: TestWindow }).window = value as unknown as TestWindow;
}

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

  afterEach(() => {
    setShellBuildTargetForTests(null);
    if (originalShell !== undefined) {
      (globalThis.window as TestWindow).satelliteShell = originalShell;
    } else {
      delete (globalThis.window as TestWindow).satelliteShell;
    }
  });

  test("Tauri desktop 壳为 desktop", () => {
    setShellBuildTargetForTests("desktop");
    setTestWindow({
      satelliteShell: { isTauri: true, isNativeShell: true },
    } as Partial<TestWindow>);
    expect(resolveSettingsContentPlatform()).toBe("desktop");
  });

  test("Tauri mobile 壳为 mobile", () => {
    setShellBuildTargetForTests("mobile");
    setTestWindow({
      satelliteShell: { isTauri: true, isNativeShell: true },
    } as Partial<TestWindow>);
    expect(resolveSettingsContentPlatform()).toBe("mobile");
  });

  test("Web 无壳为 desktop", () => {
    setTestWindow({});
    expect(resolveSettingsContentPlatform()).toBe("desktop");
  });
});
