/// <reference lib="dom" />
import { getPortalApiOrigin, isPortalShell } from "./portal-shell.ts";

/**
 * 解析 companion/dev 本地 HTTP 根（Portal 壳用 apiOrigin；无壳时用页面 origin）。
 * 仅本地 HMR / runtime WS；配置不经此 origin（走 Habitat RPC）。
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
