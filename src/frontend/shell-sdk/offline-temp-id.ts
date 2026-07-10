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

export function resetTempIdAllocatorForTests(): void {
  scopeCounters.clear();
}

export function isTempId(id: unknown): id is number {
  return typeof id === "number" && Number.isInteger(id) && id < 0;
}
