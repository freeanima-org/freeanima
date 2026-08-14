import { loadIdMap } from "./offline-id-map.ts";
import type { OfflineModuleId } from "./offline-outbox.ts";

const scopeCounters = new Map<string, number>();

function counterKey(scope: string, moduleId: string): string {
  return `${scope}|${moduleId}`;
}

/** 分配本地负整数 temp entity id（单 tab 进程内单调递减）。 */
export function allocateTempId(scope: string, moduleId: string): number {
  const key = counterKey(scope, moduleId);
  const prev = scopeCounters.get(key) ?? 0;
  const next = prev === 0 ? -1 : prev - 1;
  scopeCounters.set(key, next);
  return next;
}

/**
 * 用 id-map 中已有的负 temp 键推进 allocator，避免页面刷新后复用仍映射中的负 id。
 * 若 map 为空且尚未分配，保持默认起点。
 */
export async function seedTempIdAllocatorFromIdMap(
  scope: string,
  moduleId: OfflineModuleId,
): Promise<void> {
  const map = await loadIdMap(scope, moduleId);
  if (map.size === 0) return;
  let minTemp = 0;
  for (const tempId of map.keys()) {
    if (tempId < minTemp) minTemp = tempId;
  }
  if (minTemp >= 0) return;
  const key = counterKey(scope, moduleId);
  const current = scopeCounters.get(key) ?? 0;
  // allocator 存的是「上一次分配出的值」；下一次会 current - 1。
  // 若已映射到 minTemp，下次至少从 minTemp - 1 起。
  if (current === 0 || current > minTemp) {
    scopeCounters.set(key, minTemp);
  }
}

export function resetTempIdAllocatorForTests(): void {
  scopeCounters.clear();
}

export function isTempId(id: number): boolean;
export function isTempId(id: unknown): id is number;
export function isTempId(id: unknown): boolean {
  return typeof id === "number" && Number.isInteger(id) && id < 0;
}
