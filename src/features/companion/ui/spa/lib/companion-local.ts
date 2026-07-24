/// <reference lib="dom" />
import { getPortalApiOrigin, isPortalShell } from "./portal-shell.ts";

/**
 * 解析 companion/dev 本地 HTTP 根（Portal 壳用 apiOrigin；无壳时用页面 origin）。
 * 产品 Portal/Tauri 不依赖独立 Node 进程；仅本地 HMR / 无壳调试用此路径。
 */
export async function resolveCompanionDevOrigin(_maxWaitMs = 45_000): Promise<string> {
  const origin = getPortalApiOrigin();
  if (isPortalShell() && origin) {
    return origin;
  }
  return window.location.origin;
}

/** 解析 Habitat HTTP 根（优先 portalShell.habitatUrl） */
export async function resolveHubBaseUrl(): Promise<string> {
  const shell = (window as Window & { portalShell?: { habitatUrl?: string } }).portalShell;
  return shell?.habitatUrl?.trim().replace(/\/$/, "") || "http://127.0.0.1:2658";
}
