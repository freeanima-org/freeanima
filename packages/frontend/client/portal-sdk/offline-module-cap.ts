import type { OfflineModuleId, OfflineOutboxOp } from "./offline-outbox.ts";
import { isFailedOutboxOp, isStaleOutboxOp, listOutboxOps } from "./offline-outbox.ts";
import { isOfflineWritableModule, listOfflineModules } from "./offline-module-registry.ts";

export type GlobalOutboxSummary = {
  pending: number;
  failed: number;
  stale: number;
  ops: OfflineOutboxOp[];
};

export type ModuleOutboxSummary = {
  pending: number;
  failed: number;
  stale: number;
  ops: OfflineOutboxOp[];
};

function summarizeOps(ops: OfflineOutboxOp[]): Omit<GlobalOutboxSummary, "ops"> & {
  ops: OfflineOutboxOp[];
} {
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

export async function getGlobalPendingCount(scope: string): Promise<number> {
  const summary = await getGlobalOutboxSummary(scope);
  return summary.pending;
}

export async function getGlobalOutboxSummary(scope: string): Promise<GlobalOutboxSummary> {
  const ops: OfflineOutboxOp[] = [];
  for (const adapter of listOfflineModules()) {
    if (!isOfflineWritableModule(adapter.moduleId)) continue;
    ops.push(...(await listOutboxOps(scope, adapter.moduleId)));
  }
  return summarizeOps(ops);
}

export async function getModuleOutboxSummary(
  scope: string,
  moduleId: OfflineModuleId,
): Promise<ModuleOutboxSummary> {
  const ops = await listOutboxOps(scope, moduleId);
  return summarizeOps(ops);
}

/** 仅未失败、未 stale 的待同步条数（不含 problem ops）。 */
export async function getModulePendingCount(
  scope: string,
  moduleId: OfflineModuleId,
): Promise<number> {
  const summary = await getModuleOutboxSummary(scope, moduleId);
  return summary.pending;
}
