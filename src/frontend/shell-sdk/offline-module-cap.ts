import type { OfflineModuleId, OfflineOutboxOp } from "./offline-outbox.ts";
import {
  countOutboxOps,
  isFailedOutboxOp,
  isStaleOutboxOp,
  listOutboxOps,
} from "./offline-outbox.ts";
import { isOfflineWritableModule, listOfflineModules } from "./offline-module-registry.ts";

export type GlobalOutboxSummary = {
  pending: number;
  failed: number;
  stale: number;
  ops: OfflineOutboxOp[];
};

export async function getGlobalPendingCount(scope: string): Promise<number> {
  let total = 0;
  for (const adapter of listOfflineModules()) {
    if (!isOfflineWritableModule(adapter.moduleId)) continue;
    total += await countOutboxOps(scope, adapter.moduleId);
  }
  return total;
}

export async function getGlobalOutboxSummary(scope: string): Promise<GlobalOutboxSummary> {
  const ops: OfflineOutboxOp[] = [];
  for (const adapter of listOfflineModules()) {
    if (!isOfflineWritableModule(adapter.moduleId)) continue;
    ops.push(...(await listOutboxOps(scope, adapter.moduleId)));
  }

  let pending = 0;
  let failed = 0;
  let stale = 0;
  for (const op of ops) {
    if (isStaleOutboxOp(op)) {
      stale += 1;
    } else if (isFailedOutboxOp(op)) {
      failed += 1;
    } else {
      pending += 1;
    }
  }

  return { pending, failed, stale, ops };
}

export async function getModulePendingCount(
  scope: string,
  moduleId: OfflineModuleId,
): Promise<number> {
  return countOutboxOps(scope, moduleId);
}
