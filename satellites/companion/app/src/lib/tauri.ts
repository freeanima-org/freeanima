/** Tauri 壳层桥接；浏览器 dev 模式下为 no-op */

import type { ScreenPoint } from "./window-metrics.ts";

type TauriWindow = {
  __TAURI__?: {
    core: {
      invoke: <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;
    };
    event: {
      listen: <T>(event: string, handler: (ev: { payload: T }) => void) => Promise<() => void>;
      emit: (event: string, payload?: unknown) => Promise<void>;
    };
  };
};

function tauri(): TauriWindow["__TAURI__"] | null {
  return (window as TauriWindow).__TAURI__ ?? null;
}

export function isTauri(): boolean {
  return tauri() !== null;
}

export async function setClickThrough(ignore: boolean): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("set_clickthrough", { ignore });
}

export async function setPointerActive(active: boolean): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("set_pointer_active", { active });
}

export async function moveWindow(x: number, y: number): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("move_window", { x, y });
}

export type PatrolScreenInfo = {
  availLeft: number;
  availTop: number;
  availWidth: number;
  availHeight: number;
  windowWidth: number;
  windowHeight: number;
};

export async function getPatrolScreen(): Promise<PatrolScreenInfo> {
  const api = tauri();
  if (!api) {
    throw new Error("not in tauri");
  }
  return api.core.invoke<PatrolScreenInfo>("get_patrol_screen");
}

export async function getWindowPosition(): Promise<ScreenPoint> {
  const api = tauri();
  if (!api) {
    return { x: 0, y: 0 };
  }
  const [x, y] = await api.core.invoke<[number, number]>("get_window_position");
  return { x, y };
}

export async function listenCursorPosition(
  handler: (pos: { x: number; y: number }) => void,
): Promise<() => void> {
  const api = tauri();
  if (!api) return () => {};
  return api.event.listen<{ x: number; y: number }>("cursor-position", (ev) => {
    handler(ev.payload);
  });
}

export async function startWindowDrag(): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("start_drag");
}

export async function getSidecarPort(): Promise<number | null> {
  const api = tauri();
  if (!api) return null;
  return api.core.invoke<number>("get_sidecar_port");
}

export async function listenSidecarReady(handler: (port: number) => void): Promise<() => void> {
  const api = tauri();
  if (!api) return () => {};
  return api.event.listen<number>("sidecar-ready", (ev) => {
    handler(ev.payload);
  });
}

export async function listenSidecarError(handler: (message: string) => void): Promise<() => void> {
  const api = tauri();
  if (!api) return () => {};
  return api.event.listen<string>("sidecar-error", (ev) => {
    handler(ev.payload);
  });
}

export async function openSettings(): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.core.invoke("open_settings");
}

export async function emitConfigChanged(): Promise<void> {
  const api = tauri();
  if (!api) return;
  await api.event.emit("companion-config-changed");
}

export async function listenConfigChanged(handler: () => void): Promise<() => void> {
  const api = tauri();
  if (!api) return () => {};
  return api.event.listen("companion-config-changed", () => {
    handler();
  });
}

export function isSettingsRoute(): boolean {
  return window.location.hash === "#/settings";
}
