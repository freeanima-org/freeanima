import type { EntityStorePort } from "../ports/entity.ts";

import { pgUnavailableStore } from "./null-helpers.ts";

const unavailable = (): never => pgUnavailableStore("entity store");

export const nullEntityStore: EntityStorePort = {
  create: unavailable,
  get: unavailable,
  update: unavailable,
  delete: unavailable,
  list: unavailable,
  count: unavailable,
};
