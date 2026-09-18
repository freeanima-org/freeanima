import { Service, type Context } from "cordis";
import type { ObjectStore } from "./object-store.ts";

declare module "cordis" {
  interface Context {
    objectStore: ObjectStoreService;
  }
}

/**
 * Cordis service (`ctx.objectStore`) holding the active object store bound by
 * the composition root. Replaces the module-level singleton in
 * `object-storage/domain/object-store.ts`.
 */
export class ObjectStoreService extends Service {
  private store: ObjectStore | null = null;

  constructor(ctx: Context) {
    super(ctx, "objectStore");
  }

  bind(store: ObjectStore): void {
    this.store = store;
  }

  get(): ObjectStore | null {
    return this.store;
  }

  reset(): void {
    this.store = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountObjectStoreService(ctx: Context): ObjectStoreService {
  const existing = ctx.objectStore as ObjectStoreService | undefined;
  if (existing) return existing;
  return new ObjectStoreService(ctx);
}
