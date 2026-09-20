import { Context, Service } from "cordis";
import type { EnvHealthBaselineStore } from "./baseline.ts";

declare module "cordis" {
  interface Context {
    envHealthBaselineStore: EnvHealthBaselineStoreService;
  }
}

/**
 * Cordis service (`ctx.envHealthBaselineStore`) holding the active env-health
 * baseline store. Replaces the module-level singleton in
 * `service/env-health/baseline.ts`.
 */
export class EnvHealthBaselineStoreService extends Service {
  private store: EnvHealthBaselineStore | null = null;

  constructor(ctx: Context) {
    super(ctx, "envHealthBaselineStore");
  }

  bind(store: EnvHealthBaselineStore | null): void {
    this.store = store;
  }

  get(): EnvHealthBaselineStore | null {
    return this.store;
  }

  reset(): void {
    this.store = null;
  }
}

let current: EnvHealthBaselineStoreService | null = null;
let ownedCtx: Context | null = null;

/** 模块内单例（不再查进程根 context）。 */
export function ensureEnvHealthBaselineStoreService(): EnvHealthBaselineStoreService {
  if (!current) {
    ownedCtx ??= new Context();
    current = new EnvHealthBaselineStoreService(ownedCtx);
  }
  return current;
}

export function currentEnvHealthBaselineStoreService(): EnvHealthBaselineStoreService | null {
  return current;
}

/** Test teardown。 */
export function resetEnvHealthBaselineStoreServiceForTest(): void {
  current = null;
  ownedCtx = null;
}
