const DEFAULT_HUB_ORIGIN = "http://127.0.0.1:2658";

/** Habitat REST 根（优先 satelliteShell.habitatUrl；Web 空则页面 origin；原生壳回退默认） */
export function resolveHabitatApiOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_HUB_ORIGIN;

  const shellHub = window.satelliteShell?.habitatUrl?.trim().replace(/\/$/, "");
  if (shellHub) return shellHub;

  if (window.satelliteShell?.isNativeShell || window.satelliteShell?.isTauri) {
    return DEFAULT_HUB_ORIGIN;
  }

  return window.location.origin;
}

export { DEFAULT_HUB_ORIGIN };
