import { Context, Service } from "cordis";
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

let current: ObjectStoreService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureObjectStoreService(): ObjectStoreService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new ObjectStoreService(ownedCtx);
  }
  return current;
}

export function currentObjectStoreService(): ObjectStoreService | null {
  return current;
}

/** Test teardown。 */
export function resetObjectStoreServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
