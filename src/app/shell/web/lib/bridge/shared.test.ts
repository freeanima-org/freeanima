import { afterEach, describe, expect, it } from "bun:test";

import { isCapacitorRuntime, isCapacitorShellCandidate } from "./shared.ts";

describe("shell-bridge shared", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("isCapacitorShellCandidate 桌面浏览器为 false", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    } as unknown as Window;

    expect(isCapacitorShellCandidate()).toBe(false);
  });

  it("远程 Habitat 手机 UA 无 Capacitor 不为候选", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { origin: "https://hub.example.com" },
    } as unknown as Window;

    expect(isCapacitorRuntime()).toBe(false);
    expect(isCapacitorShellCandidate()).toBe(false);
  });

  it("薄壳 localhost 无 window.Capacitor 仍为候选", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)" },
      location: { origin: "http://localhost" },
    } as unknown as Window;

    expect(isCapacitorRuntime()).toBe(false);
    expect(isCapacitorShellCandidate()).toBe(true);
  });
});
