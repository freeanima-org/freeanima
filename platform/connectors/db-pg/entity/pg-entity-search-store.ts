import type { EntitySearchOpts, EntitySearchPort } from "@freeanima/core/repos";

import * as searchRepo from "./search/entity-search-repo.ts";

export const pgEntitySearchStore: EntitySearchPort = {
  search: (opts?: EntitySearchOpts) => searchRepo.searchEntities(opts),
  count: (opts?: Omit<EntitySearchOpts, "offset" | "limit">) =>
    searchRepo.countEntitiesSearch(opts),
};

export { resolvePublicAccessibleWorldIds } from "./search/accessible-worlds.ts";
export { EntitySearchScopeError } from "./search/entity-search-repo.ts";
