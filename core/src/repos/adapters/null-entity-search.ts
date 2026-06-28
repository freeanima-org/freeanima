import type { EntitySearchPort } from "../ports/entity-search.ts";

import { pgUnavailableStore } from "./null-helpers.ts";

const unavailable = (): never => pgUnavailableStore("entity search");

export const nullEntitySearchStore: EntitySearchPort = {
  search: unavailable,
  count: unavailable,
};
