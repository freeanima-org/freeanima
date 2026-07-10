/// <reference lib="dom" />
import type { SatelliteShellApi } from "./shell-api.ts";
import { resolveHubRpcWsUrl } from "./hub-ws-url.ts";
import { getSubjectKind } from "./subject-scope-store.ts";
import {
  OFFLINE_KV_STORE,
  offlineDbGet,
  offlineDbPut,
  setOfflineDbBackendForTests,
} from "./offline-db.ts";

export { OFFLINE_OUTBOX_STORE } from "./offline-db.ts";

const ENVELOPE_VERSION = 1 as const;

type MemoryBackend = Map<string, unknown>;

type OfflineCacheEnvelope<T> = {
  v: typeof ENVELOPE_VERSION;
  data: T;
  cachedAt: string;
};

export type OfflineCacheEntry<T> = {
  data: T;
  cachedAt: Date | null;
};

export function setSatelliteOfflineCacheBackendForTests(map: MemoryBackend | null): void {
  setOfflineDbBackendForTests(map);
}

export function resolveCacheScope(hubWsUrl: string): string {
  return hubWsUrl.trim().toLowerCase();
}

function readFallbackHubWs(): string {
  if (typeof process !== "undefined" && process.env) {
    const fromVite = process.env.VITE_FREEANIMA_HUB_WS?.trim();
    if (fromVite) return fromVite;
    const hubUrl = process.env.FREEANIMA_URL?.trim();
    if (hubUrl) return resolveHubRpcWsUrl(hubUrl.replace(/\/$/, ""));
  }
  return resolveHubRpcWsUrl("http://127.0.0.1:2658");
}

export function resolveHubCacheScope(): string {
  const shell = (globalThis.window as (Window & { satelliteShell?: SatelliteShellApi }) | undefined)
    ?.satelliteShell;
  let hubScope: string;
  if (shell?.hubWsUrl?.trim()) {
    hubScope = resolveCacheScope(shell.hubWsUrl);
  } else {
    hubScope = resolveCacheScope(readFallbackHubWs());
  }
  return `${hubScope}:${getSubjectKind()}`;
}

function cacheKey(scope: string, namespace: string, id: string): string {
  return `${scope}|${namespace}|${id}`;
}

function isEnvelope<T>(raw: unknown): raw is OfflineCacheEnvelope<T> {
  return (
    raw !== null &&
    typeof raw === "object" &&
    "v" in raw &&
    (raw as OfflineCacheEnvelope<T>).v === ENVELOPE_VERSION &&
    "data" in raw
  );
}

function unwrapStored<T>(raw: unknown): OfflineCacheEntry<T> | null {
  if (raw == null) return null;
  if (isEnvelope<T>(raw)) {
    const at = Date.parse(raw.cachedAt);
    return { data: raw.data, cachedAt: Number.isFinite(at) ? new Date(at) : null };
  }
  return { data: raw as T, cachedAt: null };
}

export async function readOfflineCacheEntry<T>(
  scope: string,
  namespace: string,
  id: string,
): Promise<OfflineCacheEntry<T> | null> {
  const raw = await offlineDbGet(OFFLINE_KV_STORE, cacheKey(scope, namespace, id));
  return unwrapStored<T>(raw);
}

export async function readOfflineCache<T>(
  scope: string,
  namespace: string,
  id: string,
): Promise<T | null> {
  const entry = await readOfflineCacheEntry<T>(scope, namespace, id);
  return entry?.data ?? null;
}

export async function writeOfflineCache<T>(
  scope: string,
  namespace: string,
  id: string,
  value: T,
): Promise<void> {
  const envelope: OfflineCacheEnvelope<T> = {
    v: ENVELOPE_VERSION,
    data: value,
    cachedAt: new Date().toISOString(),
  };
  await offlineDbPut(OFFLINE_KV_STORE, cacheKey(scope, namespace, id), envelope);
}

export function formatOfflineCacheTime(cachedAt: Date, locale?: string): string {
  return cachedAt.toLocaleString(locale);
}
