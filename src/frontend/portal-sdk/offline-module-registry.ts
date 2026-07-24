import type { OfflineModuleAdapter, OfflineModuleCap } from "./offline-module-types.ts";
import type { OfflineModuleId } from "./offline-outbox.ts";

const adapters = new Map<OfflineModuleId, OfflineModuleAdapter>();
const caps = new Map<OfflineModuleId, OfflineModuleCap>();

export function registerOfflineModule(adapter: OfflineModuleAdapter): void {
  adapters.set(adapter.moduleId, adapter);
}

export function unregisterOfflineModule(moduleId: OfflineModuleId): void {
  adapters.delete(moduleId);
}

export function getOfflineModule(moduleId: OfflineModuleId): OfflineModuleAdapter | undefined {
  return adapters.get(moduleId);
}

export function listOfflineModules(): OfflineModuleAdapter[] {
  return [...adapters.values()];
}

export function registerOfflineModuleCap(moduleId: OfflineModuleId, cap: OfflineModuleCap): void {
  caps.set(moduleId, cap);
}

export function getOfflineModuleCap(moduleId: OfflineModuleId): OfflineModuleCap | undefined {
  return caps.get(moduleId);
}

export function isOfflineWritableModule(moduleId: OfflineModuleId): boolean {
  return caps.get(moduleId)?.offlineWritable === true;
}

export function resetOfflineModuleRegistryForTests(): void {
  adapters.clear();
  caps.clear();
}
