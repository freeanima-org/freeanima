import { createBearerFetch, type HubFetch } from "./remote-auth.ts";
import { HUB_URL_KEY, REMOTE_AUTH_TOKEN_KEY } from "./settings/prefs-keys.ts";
import { resolveHubApiOrigin } from "./hub-api-origin.ts";

type SatelliteShellBridge = {
  hubUrl?: string;
  hubFetch?: HubFetch;
  remoteAuth?: { token?: string };
};

function satelliteShell(): SatelliteShellBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { satelliteShell?: SatelliteShellBridge }).satelliteShell;
}

function resolveRemoteAuthToken(): string | undefined {
  const fromShell = satelliteShell()?.remoteAuth?.token?.trim();
  if (fromShell) return fromShell;
  if (typeof localStorage === "undefined") return undefined;
  return localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() || undefined;
}

export function resolveHubApiFetch(): HubFetch {
  const shell = satelliteShell();
  if (shell?.hubFetch) return shell.hubFetch;

  const origin = resolveHubApiOrigin();
  const token = resolveRemoteAuthToken();
  if (token) return createBearerFetch(token, origin);
  return fetch;
}

/**
 * CapacitorHttp 全局 patch 的 fetch 会把非 JSON POST 响应当文本，破坏 audio/mpeg。
 * TTS 等二进制须走 CapacitorWebFetch（原生 WebView fetch），由 Hub CORS 放行 localhost。
 */
export function resolveBinarySafeHubFetch(): HubFetch {
  const origin = resolveHubApiOrigin();
  const token = resolveRemoteAuthToken();
  const baseFetch = resolveCapacitorWebFetch();
  if (token) return createBearerFetch(token, origin, baseFetch);
  return baseFetch;
}

function resolveCapacitorWebFetch(): HubFetch {
  if (typeof window === "undefined") return fetch;
  const webFetch = (window as Window & { CapacitorWebFetch?: HubFetch }).CapacitorWebFetch;
  if (typeof webFetch === "function") {
    return (input, init) => webFetch(input, init);
  }
  return fetch;
}

export function resolveHubApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${resolveHubApiOrigin()}${normalized}`;
}

/** 供设置/bootstrap 写入后刷新 hubUrl 推断（测试用） */
export function readStoredHubUrl(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(HUB_URL_KEY)?.trim() || null;
}
