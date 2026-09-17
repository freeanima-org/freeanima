/// <reference lib="dom" />
import { isRecord } from "@freeanima/shared/util";

import type { ShellApi } from "./shell-api.ts";
import { resolveHabitatRpcWsUrl } from "./habitat-ws-url.ts";
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

export function resolveCacheScope(habitatWsUrl: string): string {
  return habitatWsUrl.trim().toLowerCase();
}

function readFallbackHubWs(): string {
  if (typeof process !== "undefined" && process.env) {
    const fromVite = process.env.VITE_FREEANIMA_HABITAT_WS?.trim();
    if (fromVite) return fromVite;
    const habitatUrl = process.env.FREEANIMA_URL?.trim();
    if (habitatUrl) return resolveHabitatRpcWsUrl(habitatUrl.replace(/\/$/, ""));
  }
  return resolveHabitatRpcWsUrl("http://127.0.0.1:2658");
}

export function resolveHabitatCacheScope(): string {
  const shell = (globalThis.window as (Window & { portalShell?: ShellApi }) | undefined)
    ?.portalShell;
  let habitatScope: string;
  if (shell?.habitatWsUrl?.trim()) {
    habitatScope = resolveCacheScope(shell.habitatWsUrl);
  } else {
    habitatScope = resolveCacheScope(readFallbackHubWs());
  }
  return `${habitatScope}:${getSubjectKind()}`;
}

function cacheKey(scope: string, namespace: string, id: string): string {
  return `${scope}|${namespace}|${id}`;
}

function isEnvelope(raw: unknown): raw is OfflineCacheEnvelope<unknown> {
  return isRecord(raw) && raw.v === ENVELOPE_VERSION && "data" in raw && "cachedAt" in raw;
}

function unwrapStored<T>(raw: unknown): OfflineCacheEntry<T> | null {
  if (raw == null) return null;
  if (isEnvelope(raw)) {
    const at = typeof raw.cachedAt === "string" ? Date.parse(raw.cachedAt) : Number.NaN;
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- envelope data 由写入方约定 T
    return { data: raw.data as T, cachedAt: Number.isFinite(at) ? new Date(at) : null };
  }
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- 旧版无 envelope 裸缓存，调用方约定 T
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

export async function writeOfflineCache(
  scope: string,
  namespace: string,
  id: string,
  value: unknown,
): Promise<void> {
  const envelope: OfflineCacheEnvelope<unknown> = {
    v: ENVELOPE_VERSION,
    data: value,
    cachedAt: new Date().toISOString(),
  };
  await offlineDbPut(OFFLINE_KV_STORE, cacheKey(scope, namespace, id), envelope);
}

export function formatOfflineCacheTime(cachedAt: Date, locale?: string): string {
  return cachedAt.toLocaleString(locale);
}
