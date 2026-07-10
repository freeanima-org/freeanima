import type { OfflineModuleId } from "./offline-outbox.ts";
import { countOutboxOps } from "./offline-outbox.ts";
import { isOfflineWritableModule, listOfflineModules } from "./offline-module-registry.ts";

export async function getGlobalPendingCount(scope: string): Promise<number> {
  let total = 0;
  for (const adapter of listOfflineModules()) {
    if (!isOfflineWritableModule(adapter.moduleId)) continue;
    total += await countOutboxOps(scope, adapter.moduleId);
  }
  return total;
}

export async function getModulePendingCount(
  scope: string,
  moduleId: OfflineModuleId,
): Promise<number> {
  return countOutboxOps(scope, moduleId);
}
