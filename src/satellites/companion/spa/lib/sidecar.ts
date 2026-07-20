/// <reference lib="dom" />
import { getElectronApiOrigin, isElectron } from "./electron.ts";

/** Electron / 浏览器 dev：解析 companion HTTP API 根地址 */
export async function resolveSidecarOrigin(_maxWaitMs = 45_000): Promise<string> {
  const origin = getElectronApiOrigin();
  if (isElectron() && origin) {
    return origin;
  }
  return window.location.origin;
}

export async function resolveHubBaseUrl(): Promise<string> {
  const shell = (window as Window & { satelliteShell?: { habitatUrl?: string } }).satelliteShell;
  return shell?.habitatUrl?.trim().replace(/\/$/, "") || "http://127.0.0.1:2658";
}
