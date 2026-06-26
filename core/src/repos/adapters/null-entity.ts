import type { EntityStorePort } from "../ports/entity.ts";

const unavailable = (): never => {
  throw new Error("entity store unavailable (PG not configured)");
};

export const nullEntityStore: EntityStorePort = {
  create: unavailable,
  get: unavailable,
  update: unavailable,
  delete: unavailable,
  list: unavailable,
  count: unavailable,
};
