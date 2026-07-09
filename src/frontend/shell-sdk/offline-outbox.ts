/// <reference lib="dom" />
import {
  OFFLINE_OUTBOX_STORE,
  resolveHubCacheScope,
  setSatelliteOfflineCacheBackendForTests,
} from "./offline-cache.ts";

const DB_NAME = "freeanima-satellite-cache";
const DB_VERSION = 2;

type MemoryBackend = Map<string, unknown>;

let testBackend: MemoryBackend | null = null;

export type OfflineModuleId = "chat" | "diary" | (string & {});

export type OfflineOutboxOp = {
  id: string;
  moduleId: OfflineModuleId;
  method: string;
  payload: Record<string, unknown>;
  createdAt: string;
  lastError?: string;
};

export type ChatSendOutboxPayload = {
  conversation_id: string;
  message: string;
  client_op_id: string;
  expected_tail_pos: number;
  force_tail?: boolean;
  llm_debug?: boolean;
};

function outboxKey(scope: string, opId: string): string {
  return `${scope}|${opId}`;
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
        if (!db.objectStoreNames.contains("kv")) {
          db.createObjectStore("kv");
        }
        if (!db.objectStoreNames.contains(OFFLINE_OUTBOX_STORE)) {
          db.createObjectStore(OFFLINE_OUTBOX_STORE);
        }
      },
      { once: true },
    );
    req.addEventListener("success", () => resolve(req.result), { once: true });
  });
}

async function outboxGet(key: string): Promise<unknown | null> {
  if (testBackend) {
    return testBackend.get(key) ?? null;
  }
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx = db.transaction(OFFLINE_OUTBOX_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_OUTBOX_STORE).get(key);
    req.addEventListener("success", () => resolve(req.result ?? null), { once: true });
    req.addEventListener("error", () => resolve(null), { once: true });
    tx.addEventListener("complete", () => db.close(), { once: true });
  });
}

async function outboxPut(key: string, value: unknown): Promise<void> {
  if (testBackend) {
    testBackend.set(key, value);
    return;
  }
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(OFFLINE_OUTBOX_STORE, "readwrite");
    tx.objectStore(OFFLINE_OUTBOX_STORE).put(value, key);
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

async function outboxDelete(key: string): Promise<void> {
  if (testBackend) {
    testBackend.delete(key);
    return;
  }
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(OFFLINE_OUTBOX_STORE, "readwrite");
    tx.objectStore(OFFLINE_OUTBOX_STORE).delete(key);
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

async function outboxListKeys(scope: string): Promise<string[]> {
  if (testBackend) {
    const prefix = `${scope}|`;
    return [...testBackend.keys()].filter((k) => k.startsWith(prefix));
  }
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve) => {
    const keys: string[] = [];
    const tx = db.transaction(OFFLINE_OUTBOX_STORE, "readonly");
    const req = tx.objectStore(OFFLINE_OUTBOX_STORE).openCursor();
    req.addEventListener(
      "success",
      () => {
        const cursor = req.result;
        if (!cursor) return;
        const key = String(cursor.key);
        if (key.startsWith(`${scope}|`)) keys.push(key);
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

export function setOfflineOutboxBackendForTests(map: MemoryBackend | null): void {
  testBackend = map;
  setSatelliteOfflineCacheBackendForTests(map);
}

export async function enqueueOutboxOp(scope: string, op: OfflineOutboxOp): Promise<void> {
  await outboxPut(outboxKey(scope, op.id), op);
}

export async function getOutboxOp(scope: string, opId: string): Promise<OfflineOutboxOp | null> {
  const raw = await outboxGet(outboxKey(scope, opId));
  if (!raw || typeof raw !== "object") return null;
  return raw as OfflineOutboxOp;
}

export async function listOutboxOps(
  scope: string,
  moduleId?: OfflineModuleId,
): Promise<OfflineOutboxOp[]> {
  const keys = await outboxListKeys(scope);
  const ops: OfflineOutboxOp[] = [];
  for (const key of keys) {
    const raw = await outboxGet(key);
    if (!raw || typeof raw !== "object") continue;
    const op = raw as OfflineOutboxOp;
    if (moduleId && op.moduleId !== moduleId) continue;
    ops.push(op);
  }
  return ops.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOutboxOp(scope: string, opId: string): Promise<void> {
  await outboxDelete(outboxKey(scope, opId));
}

export async function updateOutboxOpError(
  scope: string,
  opId: string,
  lastError: string,
): Promise<void> {
  const op = await getOutboxOp(scope, opId);
  if (!op) return;
  await enqueueOutboxOp(scope, { ...op, lastError });
}

export function resolveOutboxScope(): string {
  return resolveHubCacheScope();
}
