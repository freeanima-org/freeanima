/// <reference lib="dom" />
import { isRecord } from "@freeanima/shared/util";

import {
  resolveHabitatCacheScope,
  setSatelliteOfflineCacheBackendForTests,
} from "./offline-cache.ts";
import {
  OFFLINE_OUTBOX_STORE,
  offlineDbDelete,
  offlineDbGet,
  offlineDbListKeys,
  offlineDbPut,
  setOfflineDbBackendForTests,
} from "./offline-db.ts";

type MemoryBackend = Map<string, unknown>;

export type OfflineModuleId =
  | "chat"
  | "diary"
  | "calendar"
  | "pomodoro"
  | "task"
  | "project"
  | "note"
  | (string & {});

/** 自动 flush 达到该次数后停止重试，需用户手动重试或丢弃。 */
export const OFFLINE_OUTBOX_MAX_ATTEMPTS = 5;

export type OfflineSyncStatus = "failed" | "stale";

export type OfflineOutboxDependsOn = {
  tempId: number;
  field: string;
};

export type OfflineOutboxOp = {
  id: string;
  moduleId: OfflineModuleId;
  method: string;
  payload: Record<string, unknown>;
  tempEntityId?: number;
  dependsOn?: OfflineOutboxDependsOn[];
  createdAt: string;
  lastError?: string;
  attempts?: number;
  syncStatus?: OfflineSyncStatus;
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

function isOfflineOutboxOp(raw: unknown): raw is OfflineOutboxOp {
  if (!isRecord(raw)) return false;
  if (typeof raw.id !== "string" || typeof raw.moduleId !== "string") return false;
  if (typeof raw.method !== "string" || typeof raw.createdAt !== "string") return false;
  return isRecord(raw.payload);
}

export type OutboxChangeEvent = {
  scope: string;
};

type OutboxChangeListener = (event: OutboxChangeEvent) => void;

const outboxListeners = new Set<OutboxChangeListener>();
const dirtyOutboxScopes = new Set<string>();
let outboxNotifyScheduled = false;

function flushOutboxNotifications(): void {
  outboxNotifyScheduled = false;
  if (dirtyOutboxScopes.size === 0 || outboxListeners.size === 0) {
    dirtyOutboxScopes.clear();
    return;
  }
  const scopes = [...dirtyOutboxScopes];
  dirtyOutboxScopes.clear();
  for (const scope of scopes) {
    const event: OutboxChangeEvent = { scope };
    for (const listener of outboxListeners) {
      try {
        listener(event);
      } catch {
        /* listener 不得打断写路径 */
      }
    }
  }
}

/** 同 tab outbox 变更；短窗内多次写合并为每 scope 一次（跨 await flush）。 */
function scheduleOutboxNotify(scope: string): void {
  dirtyOutboxScopes.add(scope);
  if (outboxNotifyScheduled) return;
  outboxNotifyScheduled = true;
  setTimeout(flushOutboxNotifications, 0);
}

/** 订阅 outbox 入队 / 删除 / 状态变更；返回取消订阅。 */
export function subscribeOutboxChanges(listener: OutboxChangeListener): () => void {
  outboxListeners.add(listener);
  return () => {
    outboxListeners.delete(listener);
  };
}

export function resetOutboxChangeListenersForTests(): void {
  outboxListeners.clear();
  dirtyOutboxScopes.clear();
  outboxNotifyScheduled = false;
}

export function setOfflineOutboxBackendForTests(map: MemoryBackend | null): void {
  setOfflineDbBackendForTests(map);
  setSatelliteOfflineCacheBackendForTests(map);
  resetOutboxChangeListenersForTests();
}

export async function enqueueOutboxOp(scope: string, op: OfflineOutboxOp): Promise<void> {
  await offlineDbPut(OFFLINE_OUTBOX_STORE, outboxKey(scope, op.id), op);
  scheduleOutboxNotify(scope);
}

export async function getOutboxOp(scope: string, opId: string): Promise<OfflineOutboxOp | null> {
  const raw = await offlineDbGet(OFFLINE_OUTBOX_STORE, outboxKey(scope, opId));
  return isOfflineOutboxOp(raw) ? raw : null;
}

export async function listOutboxOps(
  scope: string,
  moduleId?: OfflineModuleId,
): Promise<OfflineOutboxOp[]> {
  const prefix = `${scope}|`;
  const suffixes = await offlineDbListKeys(OFFLINE_OUTBOX_STORE, prefix);
  const ops: OfflineOutboxOp[] = [];
  for (const suffix of suffixes) {
    const raw = await offlineDbGet(OFFLINE_OUTBOX_STORE, `${prefix}${suffix}`);
    if (!isOfflineOutboxOp(raw)) continue;
    if (moduleId && raw.moduleId !== moduleId) continue;
    ops.push(raw);
  }
  return ops.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOutboxOp(scope: string, opId: string): Promise<void> {
  await offlineDbDelete(OFFLINE_OUTBOX_STORE, outboxKey(scope, opId));
  scheduleOutboxNotify(scope);
}

export function shouldAutoRetryOp(op: OfflineOutboxOp): boolean {
  if (op.syncStatus === "stale") return false;
  return (op.attempts ?? 0) < OFFLINE_OUTBOX_MAX_ATTEMPTS;
}

export function isStaleOutboxOp(op: OfflineOutboxOp): boolean {
  return op.syncStatus === "stale";
}

export function isFailedOutboxOp(op: OfflineOutboxOp): boolean {
  if (op.syncStatus === "stale") return false;
  return op.syncStatus === "failed" || Boolean(op.lastError);
}

export async function updateOutboxOpError(
  scope: string,
  opId: string,
  lastError: string,
): Promise<void> {
  const op = await getOutboxOp(scope, opId);
  if (!op) return;
  await enqueueOutboxOp(scope, {
    ...op,
    lastError,
    syncStatus: "failed",
    attempts: (op.attempts ?? 0) + 1,
  });
}

export async function markOutboxOpStale(scope: string, opId: string): Promise<void> {
  const op = await getOutboxOp(scope, opId);
  if (!op) return;
  await enqueueOutboxOp(scope, {
    ...op,
    syncStatus: "stale",
    lastError: "stale",
    attempts: (op.attempts ?? 0) + 1,
  });
}

export async function resetOutboxOpForRetry(scope: string, opId: string): Promise<void> {
  const op = await getOutboxOp(scope, opId);
  if (!op) return;
  const { lastError: _lastError, syncStatus: _syncStatus, ...rest } = op;
  await enqueueOutboxOp(scope, { ...rest, attempts: 0 });
}

export async function listAllOutboxOps(scope: string): Promise<OfflineOutboxOp[]> {
  return listOutboxOps(scope);
}

export async function listFailedOutboxOps(
  scope: string,
  moduleId?: OfflineModuleId,
): Promise<OfflineOutboxOp[]> {
  const ops = await listOutboxOps(scope, moduleId);
  return ops.filter((op) => isFailedOutboxOp(op) || isStaleOutboxOp(op));
}

export function resolveOutboxScope(): string {
  return resolveHabitatCacheScope();
}

export async function countOutboxOps(scope: string, moduleId?: OfflineModuleId): Promise<number> {
  const ops = await listOutboxOps(scope, moduleId);
  return ops.length;
}
