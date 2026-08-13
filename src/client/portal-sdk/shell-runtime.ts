import { getShellBuildTarget } from "./shell-build-target.ts";
import { isTauriRuntime } from "./tauri-runtime.ts";

/** 壳子维：运行时壳类型（与布局/交互正交） */
export type ShellRuntimeKind = "web" | "tauri";

function runtimeWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

/** 读取 `portalShell.isNativeShell`（壳 flag，非布局） */
export function isNativeShell(): boolean {
  const w = runtimeWindow();
  return Boolean(w?.portalShell?.isNativeShell);
}

/**
 * 一元壳类型。跟 portalShell / Tauri IPC，不跟手机 UA。
 * 若编译期 `__FREEANIMA_SHELL_TARGET__` 为 desktop/mobile，优先跟产物形态。
 */
export function getShellKind(): ShellRuntimeKind {
  const buildTarget = getShellBuildTarget();
  const w = runtimeWindow();
  const shell = w?.portalShell;

  if (buildTarget === "desktop" || buildTarget === "mobile") {
    return "tauri";
  }

  if (!w) return "web";
  if (shell?.isTauri || isTauriRuntime()) return "tauri";
  return "web";
}

/** 是否为已打包原生壳（Tauri），非纯浏览器 Web */
export function isPackagedShell(): boolean {
  return getShellKind() === "tauri";
}

/**
 * 是否展示「打开 连接设置」。
 * 优先检测 `openHabitatSettings`；否则 packaged shell 视为可打开。
 */
export function canOpenHabitatSettings(): boolean {
  const w = runtimeWindow();
  if (!w) return false;
  if (typeof w.portalShell?.openHabitatSettings === "function") return true;
  return isPackagedShell();
}

/** 原生壳导航（hash 路由 / 保存后进模块）。桌面/移动编译产物一律视为原生壳导航。 */
export function shouldUseNativeShellNavigation(): boolean {
  const buildTarget = getShellBuildTarget();
  if (buildTarget === "desktop" || buildTarget === "mobile") return true;
  const w = runtimeWindow();
  if (!w) return false;
  return Boolean(w.portalShell?.isNativeShell);
}
