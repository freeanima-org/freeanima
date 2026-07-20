import { createBearerFetch, type HabitatFetch } from "./remote-auth.ts";
import { HABITAT_URL_KEY, REMOTE_AUTH_TOKEN_KEY } from "./settings/prefs-keys.ts";
import { resolveHabitatApiOrigin } from "./habitat-api-origin.ts";

type SatelliteShellBridge = {
  habitatUrl?: string;
  habitatFetch?: HabitatFetch;
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

/**
 * 优先在渲染进程内建 Bearer fetch，避免 Electron preload 经 contextBridge
 * 返回的 Response 被结构化克隆后丢失 `.text()` / `.json()`。
 * （与栖息地 `resolveHabitatFetch` 顺序一致。）
 */
export function resolveHabitatApiFetch(): HabitatFetch {
  const shell = satelliteShell();
  const origin = resolveHabitatApiOrigin();
  const token = resolveRemoteAuthToken();
  if (token) return createBearerFetch(token, origin);
  if (shell?.habitatFetch) return shell.habitatFetch;
  return fetch;
}

/**
 * CapacitorHttp 全局 patch 的 fetch 会把非 JSON POST 响应当文本，破坏 audio/mpeg。
 * TTS 等二进制须走 CapacitorWebFetch（原生 WebView fetch），由栖息地 CORS 放行 localhost。
 */
export function resolveBinarySafeHabitatFetch(): HabitatFetch {
  const origin = resolveHabitatApiOrigin();
  const token = resolveRemoteAuthToken();
  const baseFetch = resolveCapacitorWebFetch();
  if (token) return createBearerFetch(token, origin, baseFetch);
  return baseFetch;
}

function resolveCapacitorWebFetch(): HabitatFetch {
  if (typeof window === "undefined") return fetch;
  const webFetch = (window as Window & { CapacitorWebFetch?: HabitatFetch }).CapacitorWebFetch;
  if (typeof webFetch === "function") {
    return (input, init) => webFetch(input, init);
  }
  return fetch;
}

export function resolveHubApiUrl(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${resolveHabitatApiOrigin()}${normalized}`;
}

/** 供设置/bootstrap 写入后刷新 habitatUrl 推断（测试用） */
export function readStoredHabitatUrl(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(HABITAT_URL_KEY)?.trim() || null;
}
