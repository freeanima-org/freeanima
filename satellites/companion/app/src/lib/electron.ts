/** Electron 壳层桥接；浏览器 dev 模式下为 no-op */

import type {
  CompanionShellApi,
  CompanionWindowRole,
  PatrolScreenInfo,
} from "../../../electron/types.ts";
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

/** Electron 透明 overlay 伴侣窗（非设置窗） */
export function isCompanionOverlay(): boolean {
  if (isSettingsView()) return false;
  const params = new URLSearchParams(window.location.search);
  if (params.get("view") === "overlay") return true;
  if (getWindowRole() === "overlay") return true;
  return isElectron();
}

function shell(): CompanionShellApi | undefined {
  return window.companionShell;
}

export function isElectron(): boolean {
  return shell()?.isElectron === true;
}

/** @deprecated 使用 isElectron */
export const isTauri = isElectron;

export async function setClickThrough(ignore: boolean): Promise<void> {
  await shell()?.setClickThrough(ignore);
}

export async function setPointerActive(active: boolean): Promise<void> {
  await shell()?.setPointerActive(active);
}

export async function moveWindow(x: number, y: number): Promise<void> {
  await shell()?.moveWindow(x, y);
}

export async function getPatrolScreen(): Promise<PatrolScreenInfo> {
  const api = shell();
  if (!api) {
    throw new Error("not in electron");
  }
  return api.getPatrolScreen();
}

export async function getWindowPosition(): Promise<ScreenPoint> {
  const api = shell();
  if (!api) {
    return { x: 0, y: 0 };
  }
  return api.getWindowPosition();
}

export async function listenCursorPosition(
  handler: (pos: { x: number; y: number }) => void,
): Promise<() => void> {
  const api = shell();
  if (!api) return () => {};
  return api.listenCursorPosition(handler);
}

export async function startWindowDrag(): Promise<void> {
  await shell()?.startWindowDrag();
}

export async function openSettings(): Promise<void> {
  await shell()?.openSettings();
}

export async function emitConfigChanged(): Promise<void> {
  const api = shell();
  if (api) {
    await api.emitConfigChanged();
    return;
  }
  localStorage.setItem("companion-config-changed", String(Date.now()));
}

export async function listenConfigChanged(handler: () => void): Promise<() => void> {
  const api = shell();
  if (api) {
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
  if (!api) return () => {};
  return api.listenServerError(handler);
}

/** @deprecated sidecar 端口探测已移除 */
export async function getSidecarPort(): Promise<number | null> {
  return null;
}

/** @deprecated sidecar 就绪事件已移除 */
export async function listenSidecarReady(_handler: (port: number) => void): Promise<() => void> {
  return () => {};
}

/** @deprecated 使用 listenServerError */
export async function listenSidecarError(handler: (message: string) => void): Promise<() => void> {
  return listenServerError(handler);
}

export function isSettingsRoute(): boolean {
  return isSettingsView();
}

export function getElectronApiOrigin(): string | null {
  return shell()?.apiOrigin ?? null;
}
