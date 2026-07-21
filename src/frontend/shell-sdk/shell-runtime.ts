import { isCapacitorNativePlatform, isCapacitorShellCandidate } from "./capacitor-runtime.ts";

/** 壳子维：运行时壳类型（与布局/交互正交） */
export type ShellRuntimeKind = "electron" | "capacitor" | "web" | "tauri";

function runtimeWindow(): Window | undefined {
  if (typeof window !== "undefined") return window;
  return (globalThis as { window?: Window }).window;
}

/** 读取 `satelliteShell.isNativeShell`（壳 flag，非布局） */
export function isNativeShell(): boolean {
  const w = runtimeWindow();
  return Boolean(w?.satelliteShell?.isNativeShell);
}

/**
 * 一元壳类型。跟 satelliteShell / Capacitor 原生桥，不跟手机 UA（phone ≠ Capacitor）。
 * features / shell-ui 应优先用此函数，勿手写 isElectron && isNativeShell 组合。
 */
export function getShellKind(): ShellRuntimeKind {
  const w = runtimeWindow();
  if (!w) return "web";
  const shell = w.satelliteShell as
    | (NonNullable<Window["satelliteShell"]> & { isTauri?: boolean })
    | undefined;
  if (shell?.isTauri) return "tauri";
  if (shell?.isElectron) return "electron";
  if (shell?.isNativeShell || isCapacitorNativePlatform()) {
    return "capacitor";
  }
  // 薄壳首页尚未注入 satelliteShell 时：localhost / capacitor:// 仍可能是 Capacitor
  if (isCapacitorShellCandidate()) return "capacitor";
  return "web";
}

/** @deprecated 使用 `getShellKind`；保留别名供 composition 过渡 */
export const detectShellRuntimeKind = getShellKind;

/** 是否为已打包原生壳（Electron / Capacitor），非纯浏览器 Web */
export function isPackagedShell(): boolean {
  return getShellKind() !== "web";
}

/**
 * 是否展示「打开 连接设置」。
 * 优先检测 `openHabitatSettings`；否则 packaged shell 视为可打开。
 */
export function canOpenHabitatSettings(): boolean {
  const w = runtimeWindow();
  if (!w) return false;
  if (typeof w.satelliteShell?.openHabitatSettings === "function") return true;
  return isPackagedShell();
}

/**
 * 原生壳导航（hash 路由 / 保存后进模块）。
 * Capacitor 真壳与薄壳候选；手机浏览器直连 Habitat 仍走 path。
 */
export function shouldUseNativeShellNavigation(): boolean {
  const w = runtimeWindow();
  if (!w) return false;
  if (w.satelliteShell?.isNativeShell) return true;
  return isCapacitorNativePlatform() || isCapacitorShellCandidate();
}
