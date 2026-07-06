import { getElectronApiOrigin, isElectron } from "./electron.ts";

/** Electron / 浏览器 dev：解析 companion HTTP API 根地址 */
export async function resolveSidecarOrigin(_maxWaitMs = 45_000): Promise<string> {
  const origin = getElectronApiOrigin();
  if (isElectron() && origin) {
    return origin;
  }
  return window.location.origin;
}
