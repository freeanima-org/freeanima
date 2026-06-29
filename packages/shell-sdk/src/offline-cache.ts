/// <reference lib="dom" />
import { resolveHubWsUrl } from "./hub-ws-url.ts";

const DB_NAME = "freeanima-satellite-cache";
const DB_VERSION = 1;
const STORE = "kv";

type MemoryBackend = Map<string, unknown>;

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

function openDb(): Promise<IDBDatabase | null> {
  if (testBackend || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => resolve(null);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
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
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => resolve(null);
    tx.oncomplete = () => db.close();
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
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      resolve();
    };
  });
}

export async function readOfflineCache<T>(
  scope: string,
  namespace: string,
  id: string,
): Promise<T | null> {
  const raw = await kvGet(cacheKey(scope, namespace, id));
  return (raw ?? null) as T | null;
}

export async function writeOfflineCache<T>(
  scope: string,
  namespace: string,
  id: string,
  value: T,
): Promise<void> {
  await kvSet(cacheKey(scope, namespace, id), value);
}
