/** Portal（Tauri）壳层桥接；浏览器/dev 模式下多为 no-op */

import type {
  CompanionWindowRole,
  PatrolScreenInfo,
  ShellApi,
} from "@freeanima/frontend/shell-sdk";
import type { ScreenPoint } from "./window-metrics.ts";

export type { PatrolScreenInfo, CompanionWindowRole };

export function getWindowRole(): CompanionWindowRole | null {
  return shell()?.windowRole ?? null;
}

/** 设置面板独立窗口或浏览器 #/settings */
export function isSettingsView(): boolean {
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "settings") return true;
  if (window.location.hash === "#/settings") return true;
  return getWindowRole() === "settings";
}

/** Portal 透明 overlay 伴侣窗（非设置窗） */
export function isCompanionOverlay(): boolean {
  if (isSettingsView()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "overlay") return true;
  if (getWindowRole() === "overlay") return true;
  return isPortalShell();
}

function shell(): ShellApi | undefined {
  return window.portalShell;
}

/** 是否在 Tauri Portal（含 companion overlay / 设置窗） */
export function isPortalShell(): boolean {
  const s = shell();
  return Boolean(s?.isTauri || s?.isNativeShell);
}

export async function setClickThrough(ignore: boolean): Promise<void> {
  await shell()?.setClickThrough?.(ignore);
}

export async function setPointerActive(active: boolean): Promise<void> {
  await shell()?.setPointerActive?.(active);
}

export async function moveWindow(x: number, y: number): Promise<void> {
  await shell()?.moveWindow?.(x, y);
}

export async function getPatrolScreen(): Promise<PatrolScreenInfo> {
  const api = shell();
  if (!api?.getPatrolScreen) {
    throw new Error("not in portal shell");
  }
  return api.getPatrolScreen();
}

export async function getWindowPosition(): Promise<ScreenPoint> {
  const api = shell();
  if (!api?.getWindowPosition) {
    return { x: 0, y: 0 };
  }
  return api.getWindowPosition();
}

export async function listenCursorPosition(
  handler: (pos: { x: number; y: number }) => void,
): Promise<() => void> {
  const api = shell();
  if (!api?.listenCursorPosition) return () => {};
  return api.listenCursorPosition(handler);
}

export async function startWindowDrag(): Promise<void> {
  await shell()?.startWindowDrag?.();
}

export async function openSettings(): Promise<void> {
  await shell()?.openSettings?.();
}

export async function emitConfigChanged(): Promise<void> {
  const api = shell();
  if (api?.emitConfigChanged) {
    await api.emitConfigChanged();
    return;
  }
  localStorage.setItem("companion-config-changed", String(Date.now()));
}

export async function listenConfigChanged(handler: () => void): Promise<() => void> {
  const api = shell();
  if (api?.listenConfigChanged) {
    return api.listenConfigChanged(handler);
  }
  const onStorage = (ev: StorageEvent): void => {
    if (ev.key === "companion-config-changed") handler();
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export async function listenServerError(handler: (message: string) => void): Promise<() => void> {
  const api = shell();
  if (!api?.listenServerError) return () => {};
  return api.listenServerError(handler);
}

export function isSettingsRoute(): boolean {
  return isSettingsView();
}

/** 浏览器/dev companion HTTP 根；Portal overlay 通常为 null */
export function getPortalApiOrigin(): string | null {
  return shell()?.apiOrigin ?? null;
}
