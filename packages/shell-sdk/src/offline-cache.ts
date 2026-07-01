/// <reference lib="dom" />
import { resolveHubWsUrl } from "./hub-ws-url.ts";

const DB_NAME = "freeanima-satellite-cache";
const DB_VERSION = 1;
const STORE = "kv";
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

let testBackend: MemoryBackend | null = null;

export function setSatelliteOfflineCacheBackendForTests(map: MemoryBackend | null): void {
  testBackend = map;
}

export function resolveCacheScope(hubWsUrl: string): string {
  return hubWsUrl.trim().toLowerCase();
}

export function resolveHubCacheScope(): string {
  const shell = globalThis.window?.satelliteShell;
  if (shell?.hubWsUrl?.trim()) {
    return resolveCacheScope(shell.hubWsUrl);
  }
  const env = (import.meta as ImportMeta & { env?: { VITE_FREEANIMA_HUB_WS?: string } }).env;
  if (env?.VITE_FREEANIMA_HUB_WS?.trim()) {
    return resolveCacheScope(env.VITE_FREEANIMA_HUB_WS);
  }
  return resolveCacheScope(resolveHubWsUrl("http://127.0.0.1:2658"));
}

function cacheKey(scope: string, namespace: string, id: string): string {
  return `${scope}|${namespace}|${id}`;
}

function isEnvelope<T>(raw: unknown): raw is OfflineCacheEnvelope<T> {
  return (
    typeof raw === "object" &&
    raw !== null &&
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

function openDb(): Promise<IDBDatabase | null> {
  if (testBackend || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.addEventListener("error", () => resolve(null), { once: true });
    req.addEventListener(
      "upgradeneeded",
      () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      },
      { once: true },
    );
    req.addEventListener("success", () => resolve(req.result), { once: true });
  });
}

async function kvGet(key: string): Promise<unknown | null> {
  if (testBackend) {
    return testBackend.get(key) ?? null;
  }
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.addEventListener("success", () => resolve(req.result ?? null), { once: true });
    req.addEventListener("error", () => resolve(null), { once: true });
    tx.addEventListener("complete", () => db.close(), { once: true });
  });
}

async function kvSet(key: string, value: unknown): Promise<void> {
  if (testBackend) {
    testBackend.set(key, value);
    return;
  }
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.addEventListener(
      "complete",
      () => {
        db.close();
        resolve();
      },
      { once: true },
    );
    tx.addEventListener(
      "error",
      () => {
        db.close();
        resolve();
      },
      { once: true },
    );
  });
}

export async function readOfflineCacheEntry<T>(
  scope: string,
  namespace: string,
  id: string,
): Promise<OfflineCacheEntry<T> | null> {
  const raw = await kvGet(cacheKey(scope, namespace, id));
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
  await kvSet(cacheKey(scope, namespace, id), envelope);
}

export function formatOfflineCacheTime(cachedAt: Date, locale?: string): string {
  return cachedAt.toLocaleString(locale);
}
