const DEFAULT_HUB_ORIGIN = "http://127.0.0.1:2658";

/** 静态壳 dev 页面 origin 不含 Hub REST，需回退默认地址 */
function isBundledShellWithoutApiOrigin(): boolean {
  if (typeof window === "undefined") return false;
  if (window.satelliteShell?.isElectron || window.satelliteShell?.isNativeShell) {
    return true;
  }
  return document.documentElement?.dataset?.shellUi === "1";
}

/** Hub 托管的 /web/* 页面：REST 与页面同源（排除 Vite 等 dev 静态壳端口） */
function isHubHostedWebUi(): boolean {
  if (typeof window === "undefined") return false;
  if (!window.location.pathname.startsWith("/web/")) return false;
  const port = window.location.port;
  if (port === "4173" || port === "5173" || port === "3000") return false;
  return true;
}

/** Hub REST 根（优先 satelliteShell.hubUrl，其次 Hub 托管页同源，最后 dev 默认） */
export function resolveHubApiOrigin(): string {
  if (typeof window === "undefined") return DEFAULT_HUB_ORIGIN;

  const shellHub = window.satelliteShell?.hubUrl?.trim().replace(/\/$/, "");
  if (shellHub) return shellHub;

  if (isHubHostedWebUi()) {
    return window.location.origin;
  }

  if (isBundledShellWithoutApiOrigin()) {
    return DEFAULT_HUB_ORIGIN;
  }

  return window.location.origin;
}

export { DEFAULT_HUB_ORIGIN };
