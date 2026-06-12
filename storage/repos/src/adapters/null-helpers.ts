/** Shared stub helpers for null PG adapters */
export function pgUnavailable(message = "database.url not configured"): never {
  throw new Error(message);
}

export function pgUnavailableStore(storeName: string): never {
  throw new Error(`${storeName} not configured (PostgreSQL unavailable)`);
}
