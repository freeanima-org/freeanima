import { Service, type Context } from "cordis";

import type { SearchBackend } from "./types.ts";

declare module "cordis" {
  interface Context {
    searchBackend: SearchBackendService;
  }
}

/**
 * Cordis service (`ctx.searchBackend`) holding the bound search backend.
 * Replaces the module-level singleton in `search/runtime.ts`.
 */
export class SearchBackendService extends Service {
  private backend: SearchBackend | null = null;

  constructor(ctx: Context) {
    super(ctx, "searchBackend");
  }

  set(next: SearchBackend | null): void {
    this.backend = next;
  }

  get(): SearchBackend {
    if (!this.backend) {
      throw new Error("SearchBackend is not registered (bindSearchRuntime not called)");
    }
    return this.backend;
  }

  tryGet(): SearchBackend | null {
    return this.backend;
  }

  reset(): void {
    this.backend = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountSearchBackendService(ctx: Context): SearchBackendService {
  const existing = ctx.searchBackend as SearchBackendService | undefined;
  if (existing) return existing;
  return new SearchBackendService(ctx);
}
