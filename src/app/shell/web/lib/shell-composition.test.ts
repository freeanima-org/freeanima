import { afterEach, describe, expect, it } from "bun:test";

import { setShellBuildTargetForTests } from "@freeanima/frontend/shell-sdk/shell-build-target.ts";

import { getShellKind } from "./shell-composition.ts";

describe("getShellKind", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
    setShellBuildTargetForTests(null);
  });

  it("手机浏览器直连 Habitat 为 web", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)" },
      location: { origin: "https://habitat.example.com" },
    } as unknown as Window;

    expect(getShellKind()).toBe("web");
  });

  it("isNativeShell 无 Tauri 标记仍为 web", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
      location: { origin: "https://habitat.example.com" },
      portalShell: { isNativeShell: true },
    } as unknown as Window;

    expect(getShellKind()).toBe("web");
  });

  it("编译期 desktop 为 tauri", () => {
    setShellBuildTargetForTests("desktop");
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
      location: { origin: "https://habitat.example.com" },
      portalShell: { isNativeShell: true, isTauri: true },
    } as unknown as Window;

    expect(getShellKind()).toBe("tauri");
  });

  it("编译期 mobile 为 tauri", () => {
    setShellBuildTargetForTests("mobile");
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { origin: "https://habitat.example.com" },
    } as unknown as Window;

    expect(getShellKind()).toBe("tauri");
  });
});
