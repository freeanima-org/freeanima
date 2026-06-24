/** Hub REST 根（bundled UI 跨 origin 时读 satelliteShell.hubUrl） */
export function resolveApiOrigin(): string {
  if (typeof window === "undefined") return "http://127.0.0.1:2658";
  // Electron 管理台：本地静态服代理 /api → Hub，REST 走同源避免 CORS
  if (window.satelliteShell?.isElectron) {
    return window.location.origin;
  }
  const hub = window.satelliteShell?.hubUrl?.replace(/\/$/, "");
  return hub ?? window.location.origin;
}
