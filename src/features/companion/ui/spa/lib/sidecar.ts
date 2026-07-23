/// <reference lib="dom" />
import { getPortalApiOrigin, isPortalShell } from "./portal-shell.ts";

/** Portal / 浏览器/dev：解析 companion HTTP API 根地址 */
export async function resolveSidecarOrigin(_maxWaitMs = 45_000): Promise<string> {
  const origin = getPortalApiOrigin();
  if (isPortalShell() && origin) {
    return origin;
  }
  return window.location.origin;
}

export async function resolveHubBaseUrl(): Promise<string> {
  const shell = (window as Window & { portalShell?: { habitatUrl?: string } }).portalShell;
  return shell?.habitatUrl?.trim().replace(/\/$/, "") || "http://127.0.0.1:2658";
}
