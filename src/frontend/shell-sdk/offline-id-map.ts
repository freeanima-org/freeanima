import {
  OFFLINE_ID_MAP_STORE,
  offlineDbDelete,
  offlineDbGet,
  offlineDbListKeys,
  offlineDbPut,
  setOfflineDbBackendForTests,
} from "./offline-db.ts";
import type { OfflineModuleId } from "./offline-outbox.ts";
import { setSatelliteOfflineCacheBackendForTests } from "./offline-cache.ts";

export type IdMappingEvent = {
  scope: string;
  moduleId: OfflineModuleId;
  tempId: number;
  serverId: number;
};

type IdMappingListener = (event: IdMappingEvent) => void;

const listeners = new Set<IdMappingListener>();

function idMapKey(scope: string, moduleId: OfflineModuleId, tempId: number): string {
  return `${scope}|${moduleId}|${tempId}`;
}

function emitIdMapping(event: IdMappingEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      /* listener 不得打断写路径 */
    }
  }
}

/** 订阅 temp→server id 映射写入；返回取消订阅函数。 */
export function subscribeIdMappings(listener: IdMappingListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function resetIdMappingListenersForTests(): void {
  listeners.clear();
}

export async function setIdMapping(
  scope: string,
  moduleId: OfflineModuleId,
  tempId: number,
  serverId: number,
): Promise<void> {
  await offlineDbPut(OFFLINE_ID_MAP_STORE, idMapKey(scope, moduleId, tempId), serverId);
  emitIdMapping({ scope, moduleId, tempId, serverId });
}

export async function getIdMapping(
  scope: string,
  moduleId: OfflineModuleId,
  tempId: number,
): Promise<number | null> {
  const raw = await offlineDbGet(OFFLINE_ID_MAP_STORE, idMapKey(scope, moduleId, tempId));
  return typeof raw === "number" ? raw : null;
}

export async function loadIdMap(
  scope: string,
  moduleId: OfflineModuleId,
): Promise<Map<number, number>> {
  const prefix = `${scope}|${moduleId}|`;
  const suffixes = await offlineDbListKeys(OFFLINE_ID_MAP_STORE, prefix);
  const map = new Map<number, number>();
  for (const suffix of suffixes) {
    const tempId = Number(suffix);
    if (!Number.isFinite(tempId)) continue;
    const serverId = await offlineDbGet(OFFLINE_ID_MAP_STORE, `${prefix}${suffix}`);
    if (typeof serverId === "number") map.set(tempId, serverId);
  }
  return map;
}

export async function clearIdMappings(scope: string, moduleId: OfflineModuleId): Promise<void> {
  const prefix = `${scope}|${moduleId}|`;
  const suffixes = await offlineDbListKeys(OFFLINE_ID_MAP_STORE, prefix);
  for (const suffix of suffixes) {
    await offlineDbDelete(OFFLINE_ID_MAP_STORE, `${prefix}${suffix}`);
  }
}

export function setOfflineIdMapBackendForTests(map: Map<string, unknown> | null): void {
  setOfflineDbBackendForTests(map);
  setSatelliteOfflineCacheBackendForTests(map);
}

/** 解析 payload 中的 temp id 字段为 server id（仅替换负整数）。 */
export function resolveIdFields(
  payload: Record<string, unknown>,
  idMap: ReadonlyMap<number, number>,
  fields: string[],
): Record<string, unknown> {
  const out = { ...payload };
  for (const field of fields) {
    const val = out[field];
    if (typeof val === "number" && val < 0) {
      const mapped = idMap.get(val);
      if (mapped != null) out[field] = mapped;
    }
  }
  return out;
}
