import type { EntitySearchPort, EntityStorePort } from "./ports/index.ts";

/** Shared register/get/reset for capabilities that need entity store + search */
export function createEntityModuleRegistry(label: string) {
  let entityStore: EntityStorePort | null = null;
  let entitySearch: EntitySearchPort | null = null;

  return {
    register(opts: { entityStore: EntityStorePort; entitySearch: EntitySearchPort }): void {
      entityStore = opts.entityStore;
      entitySearch = opts.entitySearch;
    },
    getEntityStore(): EntityStorePort {
      if (!entityStore) throw new Error(`${label}: entity store not registered`);
      return entityStore;
    },
    getEntitySearch(): EntitySearchPort {
      if (!entitySearch) throw new Error(`${label}: entity search not registered`);
      return entitySearch;
    },
    resetForTests(): void {
      entityStore = null;
      entitySearch = null;
    },
  };
}
