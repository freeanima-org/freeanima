import { ensureRootContext, getRootContextOrNull } from "@freeanima/kernel";

import { mountSearchBackendService } from "./runtime-service.ts";
import type { SearchBackend } from "./types.ts";

export function registerSearchBackend(next: SearchBackend | null): void {
  mountSearchBackendService(ensureRootContext()).set(next);
}

export function getSearchBackend(): SearchBackend {
  const service = getRootContextOrNull()?.searchBackend;
  if (!service) {
    throw new Error("SearchBackend is not registered (bindSearchRuntime not called)");
  }
  return service.get();
}

export function tryGetSearchBackend(): SearchBackend | null {
  return getRootContextOrNull()?.searchBackend?.tryGet() ?? null;
}

/** Test teardown */
export function resetSearchBackendForTest(): void {
  getRootContextOrNull()?.searchBackend?.reset();
}
