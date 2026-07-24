const DEFAULT_HABITAT_ORIGIN = "http://127.0.0.1:2658";

/** Habitat REST 根（优先 portalShell.habitatUrl；Web 空则页面 origin；原生壳回退默认） */
export function resolveHabitatApiOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_HABITAT_ORIGIN;

  const shellHub = window.portalShell?.habitatUrl?.trim().replace(/\/$/, "");
  if (shellHub) return shellHub;

  if (window.portalShell?.isNativeShell || window.portalShell?.isTauri) {
    return DEFAULT_HABITAT_ORIGIN;
  }

  return window.location.origin;
}

export { DEFAULT_HABITAT_ORIGIN };
