import { Service, type Context } from "cordis";
import type { RetainEngineFn } from "./retain-engine-port.ts";

declare module "cordis" {
  interface Context {
    retainEngine: RetainEngineService;
  }
}

/**
 * Cordis service (`ctx.retainEngine`) holding the retain engine override.
 * Replaces the module-level singleton in `memory/service/retain-engine-port.ts`.
 */
export class RetainEngineService extends Service {
  private fn: RetainEngineFn | null = null;

  constructor(ctx: Context) {
    super(ctx, "retainEngine");
  }

  register(fn: RetainEngineFn): void {
    this.fn = fn;
  }

  get(): RetainEngineFn | null {
    return this.fn;
  }

  reset(): void {
    this.fn = null;
  }
}

/** Mount synchronously (idempotent: re-mounting reuses the existing instance). */
export function mountRetainEngineService(ctx: Context): RetainEngineService {
  const existing = ctx.retainEngine as RetainEngineService | undefined;
  if (existing) return existing;
  return new RetainEngineService(ctx);
}
