import type { EntitySearchPort, EntityStorePort } from "@freeanima/core/repos";

let entityStore: EntityStorePort | null = null;
let entitySearch: EntitySearchPort | null = null;

export function registerEntityTaskModule(opts: {
  entityStore: EntityStorePort;
  entitySearch: EntitySearchPort;
}): void {
  entityStore = opts.entityStore;
  entitySearch = opts.entitySearch;
}

export function getEntityStoreForTask(): EntityStorePort {
  if (!entityStore) throw new Error("entity task module not registered");
  return entityStore;
}

export function getEntitySearchForTask(): EntitySearchPort {
  if (!entitySearch) throw new Error("entity task module not registered");
  return entitySearch;
}

export function defaultTaskWorldId(): number {
  return 1;
}

export function resetEntityTaskModuleForTests(): void {
  entityStore = null;
  entitySearch = null;
}
