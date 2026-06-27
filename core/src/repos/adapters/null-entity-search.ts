import type { EntitySearchPort } from "../ports/entity-search.ts";

const unavailable = (): never => {
  throw new Error("entity search unavailable (PG not configured)");
};

export const nullEntitySearchStore: EntitySearchPort = {
  search: unavailable,
  count: unavailable,
};
