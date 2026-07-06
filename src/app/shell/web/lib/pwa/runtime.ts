const STANDALONE_QUERY = "(display-mode: standalone)";
const INSTALL_DISMISS_KEY = "freeanima.pwa.installDismissedAt";
/** 7 天内不再提示安装 */
const INSTALL_DISMISS_MS = 7 * 24 * 60 * 60 * 1000;

function isCapacitorRuntime(): boolean {
  const cap = (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.() ?? cap);
}

/** 浏览器 Web 壳（非 Electron / Capacitor），可启用 PWA 安装与 SW 更新 UX */
export function isBrowserWebShell(): boolean {
  if (typeof window === "undefined") return false;
  if (window.satelliteShell?.isElectron) return false;
  if (isCapacitorRuntime()) return false;
  return true;
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia(STANDALONE_QUERY).matches;
}

export function readInstallDismissed(): boolean {
  try {
    const raw = localStorage.getItem(INSTALL_DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    return Date.now() - at < INSTALL_DISMISS_MS;
  } catch {
    return false;
  }
}

export function markInstallDismissed(): void {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()));
  } catch {
    /* ignore quota */
  }
}
