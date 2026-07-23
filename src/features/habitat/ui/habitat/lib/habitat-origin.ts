const DEFAULT_HABITAT_ORIGIN = "http://127.0.0.1:2658";

/** 静态壳页面 origin 不含 Habitat REST，需回退到默认 Habitat 地址 */
function isBundledShellWithoutApiOrigin(): boolean {
  if (typeof window === "undefined") return false;
  if (window.satelliteShell?.isNativeShell || window.satelliteShell?.isTauri) {
    return true;
  }
  return document.documentElement?.dataset?.shellUi === "1";
}

/** Habitat REST 根（bundled 客户端读 satelliteShell.habitatUrl，直连 Habitat） */
export function resolveApiOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_HABITAT_ORIGIN;
  const habitatUrl = window.satelliteShell?.habitatUrl?.trim().replace(/\/$/, "");
  if (habitatUrl) return habitatUrl;
  if (isBundledShellWithoutApiOrigin()) {
    return DEFAULT_HABITAT_ORIGIN;
  }
  return window.location.origin;
}
