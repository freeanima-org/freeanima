import type {
  EntityCreateInput,
  EntityListOpts,
  EntityRow,
  EntityStorePort,
  EntityUpdateInput,
} from "@freeanima/core/repos";

import * as crudRepo from "./repos/entity-crud-repo.ts";

export const pgEntityStore: EntityStorePort = {
  create: (input: EntityCreateInput): Promise<EntityRow> => crudRepo.createEntity(input),
  get: (id: number): Promise<EntityRow | null> => crudRepo.getEntity(id),
  update: (input: EntityUpdateInput): Promise<EntityRow | null> => crudRepo.updateEntity(input),
  delete: (id: number): Promise<boolean> => crudRepo.deleteEntity(id),
  list: (opts?: EntityListOpts): Promise<EntityRow[]> => crudRepo.listEntities(opts),
  count: (opts?: Omit<EntityListOpts, "offset" | "limit">): Promise<number> =>
    crudRepo.countEntities(opts),
};

export { countEntitiesByBodyListId } from "./repos/entity-crud-repo.ts";
