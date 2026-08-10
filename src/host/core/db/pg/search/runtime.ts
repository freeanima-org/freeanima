import type { SearchBackend } from "./types.ts";

let backend: SearchBackend | null = null;

export function registerSearchBackend(next: SearchBackend | null): void {
  backend = next;
}

export function getSearchBackend(): SearchBackend {
  if (!backend) {
    throw new Error("SearchBackend is not registered (bindSearchRuntime not called)");
  }
  return backend;
}

export function tryGetSearchBackend(): SearchBackend | null {
  return backend;
}

/** Test teardown */
export function resetSearchBackendForTest(): void {
  backend = null;
}
