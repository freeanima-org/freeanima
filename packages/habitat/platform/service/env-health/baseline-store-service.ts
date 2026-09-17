import { Service, type Context } from "cordis";
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

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountEnvHealthBaselineStoreService(ctx: Context): EnvHealthBaselineStoreService {
  const existing = ctx.envHealthBaselineStore as EnvHealthBaselineStoreService | undefined;
  if (existing) return existing;
  return new EnvHealthBaselineStoreService(ctx);
}
