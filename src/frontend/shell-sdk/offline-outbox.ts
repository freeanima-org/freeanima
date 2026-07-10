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

export async function countOutboxOps(scope: string, moduleId?: OfflineModuleId): Promise<number> {
  const ops = await listOutboxOps(scope, moduleId);
  return ops.length;
}
