const DEFAULT_HUB_ORIGIN = "http://127.0.0.1:2658";

/** 静态壳页面 origin 不含 Hub REST，需回退到默认 Hub 地址 */
function isBundledShellWithoutApiOrigin(): boolean {
  if (typeof window === "undefined") return false;
  if (window.satelliteShell?.isElectron || window.satelliteShell?.isNativeShell) {
    return true;
  }
  return document.documentElement?.dataset?.shellUi === "1";
}

/** Hub REST 根（bundled 客户端读 satelliteShell.hubUrl，直连 Hub） */
export function resolveApiOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_HUB_ORIGIN;
  const hub = window.satelliteShell?.hubUrl?.trim().replace(/\/$/, "");
  if (hub) return hub;
  if (isBundledShellWithoutApiOrigin()) {
    return DEFAULT_HUB_ORIGIN;
  }
  return window.location.origin;
}
