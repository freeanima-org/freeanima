import { afterEach, describe, expect, it } from "bun:test";
import type { ShellApi } from "@freeanima/frontend/shell-sdk";

import { isTauriMobileUserAgent, isTauriRuntime } from "./tauri-runtime.ts";

describe("tauri-runtime", () => {
  afterEach(() => {
    delete (globalThis as { window?: Window }).window;
  });

  it("isTauriRuntime：portalShell.isTauri", () => {
    (globalThis as { window: Window }).window = {
      portalShell: { isTauri: true } as ShellApi,
      location: { protocol: "https:", hostname: "example.com" },
    } as unknown as Window;
    expect(isTauriRuntime()).toBe(true);
  });

  it("isTauriRuntime：__TAURI_INTERNALS__", () => {
    (globalThis as { window: Window }).window = {
      __TAURI_INTERNALS__: {},
      location: { protocol: "https:", hostname: "example.com" },
    } as unknown as Window;
    expect(isTauriRuntime()).toBe(true);
  });

  it("isTauriRuntime：tauri.localhost 主机名", () => {
    (globalThis as { window: Window }).window = {
      location: { protocol: "https:", hostname: "tauri.localhost" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(isTauriRuntime()).toBe(true);
  });

  it("isTauriRuntime：普通浏览器 origin 为 false", () => {
    (globalThis as { window: Window }).window = {
      location: { protocol: "https:", hostname: "habitat.example.com" },
      navigator: { userAgent: "Mozilla/5.0" },
    } as unknown as Window;
    expect(isTauriRuntime()).toBe(false);
  });

  it("isTauriMobileUserAgent：仅移动 UA", () => {
    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", maxTouchPoints: 10 },
    } as unknown as Window;
    expect(isTauriMobileUserAgent()).toBe(false);

    (globalThis as { window: Window }).window = {
      navigator: { userAgent: "Mozilla/5.0 (Linux; Android 14)", maxTouchPoints: 5 },
    } as unknown as Window;
    expect(isTauriMobileUserAgent()).toBe(true);
  });
});
