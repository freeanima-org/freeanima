import { afterEach, describe, expect, test } from "bun:test";

import { setShellBuildTargetForTests } from "@freeanima/client/portal-sdk/shell-build-target.ts";

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
  const originalShell = globalThis.window?.portalShell;

  afterEach(() => {
    setShellBuildTargetForTests(null);
    if (originalShell !== undefined) {
      (globalThis.window as TestWindow).portalShell = originalShell;
    } else {
      delete (globalThis.window as TestWindow).portalShell;
    }
  });

  test("Tauri desktop 壳为 desktop", () => {
    setShellBuildTargetForTests("desktop");
    setTestWindow({
      portalShell: { isTauri: true, isNativeShell: true },
    } as Partial<TestWindow>);
    expect(resolveSettingsContentPlatform()).toBe("desktop");
  });

  test("Tauri mobile 壳为 mobile", () => {
    setShellBuildTargetForTests("mobile");
    setTestWindow({
      portalShell: { isTauri: true, isNativeShell: true },
    } as Partial<TestWindow>);
    expect(resolveSettingsContentPlatform()).toBe("mobile");
  });

  test("Web 无壳为 desktop", () => {
    setTestWindow({});
    expect(resolveSettingsContentPlatform()).toBe("desktop");
  });
});
