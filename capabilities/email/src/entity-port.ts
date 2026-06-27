import type { EntitySearchPort, EntityStorePort } from "@freeanima/core/repos";

let entityStore: EntityStorePort | null = null;
let entitySearch: EntitySearchPort | null = null;

export function registerEntityEmailModule(opts: {
  entityStore: EntityStorePort;
  entitySearch: EntitySearchPort;
}): void {
  entityStore = opts.entityStore;
  entitySearch = opts.entitySearch;
}

export function getEntityStoreForEmail(): EntityStorePort {
  if (!entityStore) throw new Error("entity email module not registered");
  return entityStore;
}

export function getEntitySearchForEmail(): EntitySearchPort {
  if (!entitySearch) throw new Error("entity email module not registered");
  return entitySearch;
}

export function defaultEmailWorldId(): number {
  return 1;
}

export function resetEntityEmailModuleForTests(): void {
  entityStore = null;
  entitySearch = null;
}
