import { describe, expect, it } from "bun:test";

import { isBrowserWebShell, isStandalonePwa, readInstallDismissed } from "./runtime.ts";

describe("pwa runtime", () => {
  it("isBrowserWebShell 在 Electron 下为 false", () => {
    const prev = globalThis.window;
    globalThis.window = {
      satelliteShell: { isElectron: true },
    } as Window & typeof globalThis.window;
    expect(isBrowserWebShell()).toBe(false);
    globalThis.window = prev;
  });

  it("isBrowserWebShell 在 Tauri 下为 false", () => {
    const prev = globalThis.window;
    globalThis.window = {
      satelliteShell: { isTauri: true },
    } as Window & typeof globalThis.window;
    expect(isBrowserWebShell()).toBe(false);
    globalThis.window = prev;
  });

  it("readInstallDismissed 无记录时为 false", () => {
    const prev = globalThis.localStorage;
    const store = new Map<string, string>();
    globalThis.localStorage = {
      getItem: (k) => store.get(k) ?? null,
      setItem: (k, v) => {
        store.set(k, v);
      },
    } as Storage;
    expect(readInstallDismissed()).toBe(false);
    globalThis.localStorage = prev;
  });

  it("isStandalonePwa 读取 display-mode media", () => {
    const prev = globalThis.window;
    globalThis.window = {
      matchMedia: (query: string) => ({
        matches: query.includes("standalone"),
        media: query,
      }),
    } as Window & typeof globalThis.window;
    expect(isStandalonePwa()).toBe(true);
    globalThis.window = prev;
  });
});
