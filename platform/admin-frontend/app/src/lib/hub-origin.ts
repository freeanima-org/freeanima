const DEFAULT_HUB_ORIGIN = "http://127.0.0.1:2658";

/** Hub REST 根（bundled 客户端读 satelliteShell.hubUrl，直连 Hub） */
export function resolveApiOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_HUB_ORIGIN;
  const hub = window.satelliteShell?.hubUrl?.trim().replace(/\/$/, "");
  if (hub) return hub;
  // Electron 静态页 origin 不含 Hub API，勿回退到 window.location.origin
  if (window.satelliteShell?.isElectron || window.satelliteShell?.isNativeShell) {
    return DEFAULT_HUB_ORIGIN;
  }
  return window.location.origin;
}
