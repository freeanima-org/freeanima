/// <reference lib="dom" />

export const OFFLINE_DB_NAME = "freeanima-satellite-cache";
export const OFFLINE_DB_VERSION = 3;

export const OFFLINE_KV_STORE = "kv";
export const OFFLINE_OUTBOX_STORE = "outbox";
export const OFFLINE_ID_MAP_STORE = "id-map";

type MemoryBackend = Map<string, unknown>;

let testBackend: MemoryBackend | null = null;

export function setOfflineDbBackendForTests(map: MemoryBackend | null): void {
  testBackend = map;
}

export function getOfflineDbBackendForTests(): MemoryBackend | null {
  return testBackend;
}

export function openOfflineDb(): Promise<IDBDatabase | null> {
  if (testBackend || typeof indexedDB === "undefined") {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION);
    req.addEventListener("error", () => resolve(null), { once: true });
    req.addEventListener(
      "upgradeneeded",
      () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(OFFLINE_KV_STORE)) {
          db.createObjectStore(OFFLINE_KV_STORE);
        }
        if (!db.objectStoreNames.contains(OFFLINE_OUTBOX_STORE)) {
          db.createObjectStore(OFFLINE_OUTBOX_STORE);
        }
        if (!db.objectStoreNames.contains(OFFLINE_ID_MAP_STORE)) {
          db.createObjectStore(OFFLINE_ID_MAP_STORE);
        }
      },
      { once: true },
    );
    req.addEventListener("success", () => resolve(req.result), { once: true });
  });
}

export async function offlineDbGet(store: string, key: string): Promise<unknown | null> {
  if (testBackend) {
    return testBackend.get(`${store}|${key}`) ?? null;
  }
  const db = await openOfflineDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).get(key);
    req.addEventListener("success", () => resolve(req.result ?? null), { once: true });
    req.addEventListener("error", () => resolve(null), { once: true });
    tx.addEventListener("complete", () => db.close(), { once: true });
  });
}

export async function offlineDbPut(store: string, key: string, value: unknown): Promise<void> {
  if (testBackend) {
    testBackend.set(`${store}|${key}`, value);
    return;
  }
  const db = await openOfflineDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).put(value, key);
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

export async function offlineDbDelete(store: string, key: string): Promise<void> {
  if (testBackend) {
    testBackend.delete(`${store}|${key}`);
    return;
  }
  const db = await openOfflineDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(store, "readwrite");
    tx.objectStore(store).delete(key);
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

export async function offlineDbListKeys(store: string, prefix: string): Promise<string[]> {
  if (testBackend) {
    const fullPrefix = `${store}|${prefix}`;
    return [...testBackend.keys()]
      .filter((k) => k.startsWith(fullPrefix))
      .map((k) => k.slice(fullPrefix.length));
  }
  const db = await openOfflineDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const keys: string[] = [];
    const tx = db.transaction(store, "readonly");
    const req = tx.objectStore(store).openCursor();
    req.addEventListener(
      "success",
      () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.key);
        if (key.startsWith(prefix)) keys.push(key.slice(prefix.length));
        cursor.continue();
      },
      { once: false },
    );
    tx.addEventListener(
      "complete",
      () => {
        db.close();
        resolve(keys);
      },
      { once: true },
    );
    tx.addEventListener(
      "error",
      () => {
        db.close();
        resolve(keys);
      },
      { once: true },
    );
  });
}
