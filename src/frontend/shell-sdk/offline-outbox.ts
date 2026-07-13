/// <reference lib="dom" />
import { resolveHubCacheScope, setSatelliteOfflineCacheBackendForTests } from "./offline-cache.ts";
import {
  OFFLINE_OUTBOX_STORE,
  offlineDbDelete,
  offlineDbGet,
  offlineDbListKeys,
  offlineDbPut,
  setOfflineDbBackendForTests,
} from "./offline-db.ts";

type MemoryBackend = Map<string, unknown>;

export type OfflineModuleId = "chat" | "diary" | "pomodoro" | "task" | "dream" | (string & {});

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

export function setOfflineOutboxBackendForTests(map: MemoryBackend | null): void {
  setOfflineDbBackendForTests(map);
  setSatelliteOfflineCacheBackendForTests(map);
}

export async function enqueueOutboxOp(scope: string, op: OfflineOutboxOp): Promise<void> {
  await offlineDbPut(OFFLINE_OUTBOX_STORE, outboxKey(scope, op.id), op);
}

export async function getOutboxOp(scope: string, opId: string): Promise<OfflineOutboxOp | null> {
  const raw = await offlineDbGet(OFFLINE_OUTBOX_STORE, outboxKey(scope, opId));
  if (!raw || typeof raw !== "object") return null;
  return raw as OfflineOutboxOp;
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
    if (!raw || typeof raw !== "object") continue;
    const op = raw as OfflineOutboxOp;
    if (moduleId && op.moduleId !== moduleId) continue;
    ops.push(op);
  }
  return ops.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function removeOutboxOp(scope: string, opId: string): Promise<void> {
  await offlineDbDelete(OFFLINE_OUTBOX_STORE, outboxKey(scope, opId));
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
  return resolveHubCacheScope();
}

export async function countOutboxOps(scope: string, moduleId?: OfflineModuleId): Promise<number> {
  const ops = await listOutboxOps(scope, moduleId);
  return ops.length;
}
