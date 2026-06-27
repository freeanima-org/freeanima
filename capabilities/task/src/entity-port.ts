import type { EntityStorePort } from "@freeanima/core/repos";
import { ENTITY_ROOT_WORLD_ID } from "@freeanima/core/db/schema";

let store: EntityStorePort | null = null;

export function registerEntityTaskModule(opts: { entityStore: EntityStorePort }): void {
  store = opts.entityStore;
}

export function getEntityStoreForTask(): EntityStorePort {
  if (!store) throw new Error("entity task module not registered");
  return store;
}

export function defaultTaskWorldId(): number {
  return ENTITY_ROOT_WORLD_ID;
}

export function resetEntityTaskModuleForTests(): void {
  store = null;
}
