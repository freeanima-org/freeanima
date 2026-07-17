const DEFAULT_HUB_ORIGIN = "http://127.0.0.1:2658";

/** Hub REST 根（优先 satelliteShell.hubUrl；Web 空则页面 origin；原生壳回退默认） */
export function resolveHubApiOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_HUB_ORIGIN;

  const shellHub = window.satelliteShell?.hubUrl?.trim().replace(/\/$/, "");
  if (shellHub) return shellHub;

  if (window.satelliteShell?.isElectron || window.satelliteShell?.isNativeShell) {
    return DEFAULT_HUB_ORIGIN;
  }

  return window.location.origin;
}

export { DEFAULT_HUB_ORIGIN };
