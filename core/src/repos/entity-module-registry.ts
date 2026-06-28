import type {
  EntityCreateInput,
  EntityListOpts,
  EntityRow,
  EntitySearchOpts,
  EntitySearchResult,
  EntityUpdateInput,
} from "@freeanima/core/db/pg/entity";

export interface EntityStorePort {
  create(input: EntityCreateInput): Promise<EntityRow>;
  get(id: number): Promise<EntityRow | null>;
  update(input: EntityUpdateInput): Promise<EntityRow | null>;
  delete(id: number): Promise<boolean>;
  list(opts?: EntityListOpts): Promise<EntityRow[]>;
  count(opts?: Omit<EntityListOpts, "offset" | "limit">): Promise<number>;
}

export interface EntitySearchPort {
  search(opts?: EntitySearchOpts): Promise<EntitySearchResult>;
  count(opts?: Omit<EntitySearchOpts, "offset" | "limit">): Promise<number>;
}

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
