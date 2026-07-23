import { createBearerFetch, type HabitatFetch } from "./remote-auth.ts";
import { HABITAT_URL_KEY, REMOTE_AUTH_TOKEN_KEY } from "./settings/prefs-keys.ts";
import { resolveHabitatApiOrigin } from "./habitat-api-origin.ts";

type PortalShellBridge = {
  habitatUrl?: string;
  habitatFetch?: HabitatFetch;
  remoteAuth?: { token?: string };
};

function portalShell(): PortalShellBridge | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as Window & { portalShell?: PortalShellBridge }).portalShell;
}

function resolveRemoteAuthToken(): string | undefined {
  const fromShell = portalShell()?.remoteAuth?.token?.trim();
  if (fromShell) return fromShell;
  if (typeof localStorage === "undefined") return undefined;
  return localStorage.getItem(REMOTE_AUTH_TOKEN_KEY)?.trim() || undefined;
}

/**
 * 优先在渲染进程内建 Bearer fetch（与栖息地 `resolveHabitatFetch` 顺序一致）。
 */
export function resolveHabitatApiFetch(): HabitatFetch {
  const shell = portalShell();
  const origin = resolveHabitatApiOrigin();
  const token = resolveRemoteAuthToken();
  if (token) return createBearerFetch(token, origin);
  if (shell?.habitatFetch) return shell.habitatFetch;
  return fetch;
}

/**
 * TTS 等二进制响应用原生 WebView fetch（勿经会损坏 MP3 字节的中间层）。
 */
export function resolveBinarySafeHabitatFetch(): HabitatFetch {
  const origin = resolveHabitatApiOrigin();
  const token = resolveRemoteAuthToken();
  if (token) return createBearerFetch(token, origin, fetch);
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
