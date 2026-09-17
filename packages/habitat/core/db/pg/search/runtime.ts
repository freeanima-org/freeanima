import {
  ensureProcessContext,
  getProcessContext,
} from "@freeanima/habitat/platform/service/process-context.ts";

import { mountSearchBackendService } from "./runtime-service.ts";
import type { SearchBackend } from "./types.ts";

export function registerSearchBackend(next: SearchBackend | null): void {
  mountSearchBackendService(ensureProcessContext()).set(next);
}

export function getSearchBackend(): SearchBackend {
  const service = getProcessContext()?.searchBackend;
  if (!service) {
    throw new Error("SearchBackend is not registered (bindSearchRuntime not called)");
  }
  return service.get();
}

export function tryGetSearchBackend(): SearchBackend | null {
  return getProcessContext()?.searchBackend?.tryGet() ?? null;
}

/** Test teardown */
export function resetSearchBackendForTest(): void {
  getProcessContext()?.searchBackend?.reset();
}
